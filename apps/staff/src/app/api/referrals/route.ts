import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  activateReferralToFirstStage,
  beginNewServiceFromReferral,
  canAccessHospitalityIntake,
  canAssignReferralFieldSpecialist,
  canManageReferrals,
  loadDirectReferralAssignEnabled,
  createPublicReferral,
  createReferralFromPriorEnrollment,
  findPossibleDuplicateClients,
  linkReferralPriorEnrollment,
  priorEnrollmentOutcomeLabel,
  setReferralPendingAuthorization,
  updateReferralClientInfo,
  type PublicReferralPayload,
  type ReferralState,
} from "@wayfinder/supabase/referral-intake";
import { assignReferralFieldSpecialist } from "@wayfinder/supabase/referral-field-specialists";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const includeActive =
    searchParams.get("includeActive") === "1" ||
    searchParams.get("includeAssigned") === "1";
  const status = searchParams.get("status");

  const admin = createServiceRoleClient();
  const directReferralAssignEnabled = await loadDirectReferralAssignEnabled(admin);
  const canAssignFieldSpecialist = canAssignReferralFieldSpecialist(session.effectiveRole);

  let query = admin
    .from("clients")
    .select(
      "id, full_name, contact_email, intake_status, referral_state, referred_at, intake_status_changed_at, current_service_id, current_stage_id, office_id, counselor_id, authorization_number, date_of_birth, primary_phone, gender, ethnicity, disability_history, created_at, prior_client_id"
    )
    .order("referred_at", { ascending: true, nullsFirst: false });

  if (status && ["new_referral", "pending_authorization", "active"].includes(status)) {
    query = query.eq("intake_status", status);
  } else if (includeActive) {
    query = query.in("intake_status", ["new_referral", "pending_authorization", "active"]);
  } else {
    query = query.in("intake_status", ["new_referral", "pending_authorization"]);
  }

  let { data: rows, error } = await query.limit(500);
  if (error?.message.includes("prior_client_id")) {
    const fallback = admin
      .from("clients")
      .select(
        "id, full_name, contact_email, intake_status, referral_state, referred_at, intake_status_changed_at, current_service_id, current_stage_id, office_id, counselor_id, authorization_number, date_of_birth, primary_phone, gender, ethnicity, disability_history, created_at"
      )
      .order("referred_at", { ascending: true, nullsFirst: false });
    const retried =
      status && ["new_referral", "pending_authorization", "active"].includes(status)
        ? await fallback.eq("intake_status", status).limit(500)
        : includeActive
          ? await fallback
              .in("intake_status", ["new_referral", "pending_authorization", "active"])
              .limit(500)
          : await fallback
              .in("intake_status", ["new_referral", "pending_authorization"])
              .limit(500);
    rows = (retried.data ?? []) as typeof rows;
    error = retried.error;
  }
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const list = rows ?? [];
  const clientIds = list.map((r) => r.id as string);
  const { data: esLinks } = clientIds.length
    ? await admin.from("es_client_assignments").select("client_id, es_user_id").in("client_id", clientIds)
    : { data: [] as { client_id: string; es_user_id: string }[] };

  const assigneeByClient = Object.fromEntries(
    (esLinks ?? []).map((l) => [l.client_id as string, l.es_user_id as string])
  );
  const assigned = new Set(Object.keys(assigneeByClient));

  const counselorIds = [...new Set(list.map((r) => r.counselor_id).filter(Boolean))] as string[];
  const serviceIds = [...new Set(list.map((r) => r.current_service_id).filter(Boolean))] as string[];
  const stageIds = [...new Set(list.map((r) => r.current_stage_id).filter(Boolean))] as string[];
  const [{ data: counselors }, { data: services }, { data: stages }] = await Promise.all([
    counselorIds.length
      ? admin.from("counselors").select("id, full_name, contact_email").in("id", counselorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; contact_email: string | null }[] }),
    serviceIds.length
      ? admin.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    stageIds.length
      ? admin.from("service_milestones").select("id, name, title").in("id", stageIds)
      : Promise.resolve({
          data: [] as { id: string; name: string | null; title: string | null }[],
        }),
  ]);

  const counselorName = Object.fromEntries(
    (counselors ?? []).map((c) => [c.id, c.full_name as string])
  );
  const serviceName = Object.fromEntries((services ?? []).map((s) => [s.id, s.name as string]));
  const stageNames = Object.fromEntries(
    (stages ?? []).map((s) => [
      s.id,
      ((s.title as string | null) || (s.name as string | null) || "").trim() || null,
    ])
  );

  const enriched = [];
  const duplicateLists: Array<
    Awaited<ReturnType<typeof findPossibleDuplicateClients>>
  > = [];
  for (const row of list) {
    const duplicates = await findPossibleDuplicateClients(admin, {
      fullName: (row.full_name as string) || "",
      dateOfBirth: row.date_of_birth as string | null,
      contactEmail: row.contact_email as string | null,
    });
    duplicateLists.push(duplicates);
  }

  const duplicatePriorIds = [
    ...new Set(
      duplicateLists.flatMap((dupes) =>
        dupes.filter((d) => d.archived_at).map((d) => d.id)
      )
    ),
  ];
  const priorStageByClient: Record<string, string | null> = {};
  const duplicateStageIds = new Set<string>();
  if (duplicatePriorIds.length) {
    const { data: priorRows } = await admin
      .from("clients")
      .select("id, current_stage_id")
      .in("id", duplicatePriorIds);
    for (const p of priorRows ?? []) {
      if (p.current_stage_id) {
        duplicateStageIds.add(p.current_stage_id as string);
        priorStageByClient[p.id as string] = p.current_stage_id as string;
      }
    }
  }

  const duplicateStageNames: Record<string, string | null> = {};
  if (duplicateStageIds.size) {
    const { data: dupStages } = await admin
      .from("service_milestones")
      .select("id, name, title")
      .in("id", [...duplicateStageIds]);
    for (const s of dupStages ?? []) {
      duplicateStageNames[s.id as string] =
        ((s.title as string | null) || (s.name as string | null) || "").trim() || null;
    }
  }

  for (let i = 0; i < list.length; i++) {
    const row = list[i]!;
    const duplicates = duplicateLists[i] ?? [];
    enriched.push({
      ...row,
      counselorName: row.counselor_id ? counselorName[row.counselor_id as string] ?? null : null,
      serviceName: row.current_service_id
        ? serviceName[row.current_service_id as string] ?? null
        : null,
      stageName: row.current_stage_id
        ? stageNames[row.current_stage_id as string] ?? null
        : null,
      hasEsAssignment: assigned.has(row.id as string),
      fieldAssigneeUserId: assigneeByClient[row.id as string] ?? null,
      possibleDuplicates: duplicates
        .filter((d) => d.id !== row.id)
        .map((d) => {
          const stageId = priorStageByClient[d.id] ?? null;
          const stageTitle = stageId ? duplicateStageNames[stageId] ?? null : null;
          return {
            ...d,
            priorOutcomeLabel: priorEnrollmentOutcomeLabel(stageTitle),
          };
        }),
    });
  }

  return NextResponse.json({
    clients: enriched,
    directReferralAssignEnabled,
    canAssignFieldSpecialist,
  });
}

/** Manual staff referral — same workflow as website, no counselor/HR emails. */
export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PublicReferralPayload & { state?: ReferralState };
  try {
    body = (await request.json()) as PublicReferralPayload & { state?: ReferralState };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state = body.state;
  if (state !== "GA") {
    return NextResponse.json({ error: "State must be GA" }, { status: 400 });
  }

  const { state: _state, ...payload } = body;
  void _state;

  const admin = createServiceRoleClient();

  const fromPrior = (body as { fromPriorClientId?: string }).fromPriorClientId?.trim();
  if (fromPrior) {
    const createdFromPrior = await createReferralFromPriorEnrollment(admin, {
      priorClientId: fromPrior,
      actorUserId: session.effectiveUserId,
      authorizationNumber: (body as { authorizationNumber?: string }).authorizationNumber,
      overrideReason: (body as { overrideReason?: string }).overrideReason,
    });
    if ("error" in createdFromPrior) {
      return NextResponse.json({ error: createdFromPrior.error }, { status: 400 });
    }
    return NextResponse.json({
      ok: true,
      clientId: createdFromPrior.clientId,
      fromPrior: true,
    });
  }

  const created = await createPublicReferral(admin, state, payload, {
    source: "manual",
    actorUserId: session.effectiveUserId,
    skipCounselorEmailAllowlist: true,
  });

  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: created.status ?? 400 });
  }

  return NextResponse.json({
    ok: true,
    clientId: created.clientId,
    possibleDuplicates: created.duplicates.length,
  });
}

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    action?:
      | "pending_authorization"
      | "activate"
      | "begin_new_service"
      | "discard"
      | "update_info"
      | "link_prior"
      | "assign_field_specialist";
    authorizationNumber?: string;
    overrideReason?: string;
    stageId?: string;
    priorClientId?: string | null;
    fieldSpecialistUserId?: string | null;
    info?: Parameters<typeof updateReferralClientInfo>[1]["patch"];
  };

  if (!body.clientId || !body.action) {
    return NextResponse.json({ error: "clientId and action required" }, { status: 400 });
  }

  const canQueue = canManageReferrals(session.effectiveRole);
  const canIntakeEdit =
    canQueue || (body.action === "update_info" && canAccessHospitalityIntake(session.effectiveRole));
  if (!canIntakeEdit) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const actor = session.effectiveUserId;

  if (body.action === "assign_field_specialist") {
    if (!canAssignReferralFieldSpecialist(session.effectiveRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const specialistId = (body.fieldSpecialistUserId ?? "").trim();
    if (!specialistId) {
      return NextResponse.json({ error: "Select a field specialist." }, { status: 400 });
    }
    const result = await assignReferralFieldSpecialist(admin, {
      clientId: body.clientId,
      fieldSpecialistUserId: specialistId,
      actorUserId: actor,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "link_prior") {
    if (!canQueue) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await linkReferralPriorEnrollment(admin, {
      clientId: body.clientId,
      priorClientId: body.priorClientId ?? null,
      actorUserId: actor,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "update_info") {
    const result = await updateReferralClientInfo(admin, {
      clientId: body.clientId,
      actorUserId: actor,
      patch: body.info ?? {},
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "pending_authorization") {
    const result = await setReferralPendingAuthorization(admin, {
      clientId: body.clientId,
      actorUserId: actor,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "activate") {
    const result = await activateReferralToFirstStage(admin, {
      clientId: body.clientId,
      actorUserId: actor,
      authorizationNumber: body.authorizationNumber,
      overrideReason: body.overrideReason,
      stageId: body.stageId,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "begin_new_service") {
    if (!canQueue) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const result = await beginNewServiceFromReferral(admin, {
      clientId: body.clientId,
      actorUserId: actor,
      authorizationNumber: body.authorizationNumber,
      overrideReason: body.overrideReason,
      priorClientId: body.priorClientId,
      stageId: body.stageId,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "discard") {
    const nowIso = new Date().toISOString();
    const { error } = await admin
      .from("clients")
      .update({
        intake_status: "discarded",
        intake_status_changed_at: nowIso,
        last_activity_at: nowIso,
      })
      .eq("id", body.clientId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    await admin.from("client_intake_events").insert({
      client_id: body.clientId,
      actor_user_id: actor,
      event_type: "discarded",
      to_value: "discarded",
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
