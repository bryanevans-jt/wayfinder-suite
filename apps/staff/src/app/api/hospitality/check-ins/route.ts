import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canLogHospitalityCheckIns,
  canViewHospitalityWorkspace,
  canViewStaffOnlyClientNotes,
} from "@wayfinder/supabase/roles";
import { clientDisplayName } from "@wayfinder/branding";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";
import {
  checkInOutcomeLabel,
  contactMonthStart,
  isCheckInOutcome,
  monthLabel,
} from "@/lib/hospitality-check-ins";
import { NextResponse } from "next/server";

function canReadCheckIns(role: string | null | undefined) {
  return (
    canViewHospitalityWorkspace(role) ||
    canViewStaffOnlyClientNotes(role) ||
    canLogHospitalityCheckIns(role)
  );
}

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canReadCheckIns(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("clientId");
  const admin = createServiceRoleClient();
  const month = contactMonthStart();

  if (clientId) {
    const { data, error } = await admin
      .from("hospitality_client_contacts")
      .select("id, client_id, contacted_by, contacted_at, contact_month, outcome, notes")
      .eq("client_id", clientId)
      .order("contacted_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const staffIds = [...new Set((data ?? []).map((r) => r.contacted_by as string))];
    const names = await loadStaffNameById(admin, staffIds, "Staff");

    return NextResponse.json({
      month,
      monthLabel: monthLabel(month),
      contacts: (data ?? []).map((r) => ({
        id: r.id as string,
        client_id: r.client_id as string,
        contacted_by: r.contacted_by as string,
        contacted_by_name: names.get(r.contacted_by as string) ?? "Staff",
        contacted_at: r.contacted_at as string,
        contact_month: r.contact_month as string,
        outcome: r.outcome as string,
        outcome_label: checkInOutcomeLabel(r.outcome as string),
        notes: (r.notes as string | null) ?? null,
      })),
    });
  }

  if (!canViewHospitalityWorkspace(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [{ data: clients, error: clientError }, { data: contacts, error: contactError }] =
    await Promise.all([
      admin
        .from("clients")
        .select("id, primary_phone, contact_email, full_name, user_id, profile_id")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(5000),
      admin
        .from("hospitality_client_contacts")
        .select("id, client_id, contacted_at, outcome, notes, contacted_by")
        .eq("contact_month", month)
        .order("contacted_at", { ascending: false }),
    ]);

  if (clientError) {
    return NextResponse.json({ error: clientError.message }, { status: 500 });
  }
  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }

  const clientIds = (clients ?? []).map((c) => c.id as string);
  const clientById = new Map((clients ?? []).map((c) => [c.id as string, c]));

  const missingNameAuthIds = [
    ...new Set(
      (clients ?? [])
        .filter((c) => !(c.full_name as string | null)?.trim())
        .flatMap((c) => [c.user_id as string | null, c.profile_id as string | null])
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const { data: profiles } = missingNameAuthIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", missingNameAuthIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const profileName = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
  );

  const nameById = new Map<string, string>();
  for (const c of clients ?? []) {
    const id = c.id as string;
    const authId = ((c.user_id as string | null) ?? (c.profile_id as string | null)) || null;
    nameById.set(
      id,
      clientDisplayName({
        full_name:
          (c.full_name as string | null) ||
          (authId ? profileName.get(authId) ?? null : null),
        contact_email: c.contact_email as string | null,
        id,
      })
    );
  }

  const latestByClient = new Map<
    string,
    { contacted_at: string; outcome: string; notes: string | null }
  >();
  for (const row of contacts ?? []) {
    const id = row.client_id as string;
    if (!latestByClient.has(id)) {
      latestByClient.set(id, {
        contacted_at: row.contacted_at as string,
        outcome: row.outcome as string,
        notes: (row.notes as string | null) ?? null,
      });
    }
  }

  const rows = clientIds
    .map((id) => {
      const last = latestByClient.get(id);
      const client = clientById.get(id);
      return {
        id,
        name: nameById.get(id) ?? "Unknown client",
        primary_phone: (client?.primary_phone as string | null) ?? null,
        contact_email: (client?.contact_email as string | null) ?? null,
        contacted_this_month: Boolean(last),
        last_contacted_at: last?.contacted_at ?? null,
        last_outcome: last?.outcome ?? null,
        last_outcome_label: last ? checkInOutcomeLabel(last.outcome) : null,
        last_notes: last?.notes ?? null,
      };
    })
    .sort((a, b) => {
      if (a.contacted_this_month !== b.contacted_this_month) {
        return a.contacted_this_month ? 1 : -1;
      }
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });

  const contacted = rows.filter((r) => r.contacted_this_month).length;

  return NextResponse.json({
    month,
    monthLabel: monthLabel(month),
    total: rows.length,
    contacted,
    remaining: rows.length - contacted,
    clients: rows,
  });
}

export async function POST(request: Request) {
  const session = await getAppSession();
  if (!session || !canLogHospitalityCheckIns(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await assertNotPreviewMutation();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Read-only preview" },
      { status: 403 }
    );
  }

  const body = (await request.json()) as {
    clientId?: string;
    outcome?: string;
    notes?: string;
  };
  const clientId = (body.clientId ?? "").trim();
  const outcome = (body.outcome ?? "reached").trim();
  const notes = (body.notes ?? "").trim() || null;

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }
  if (!isCheckInOutcome(outcome)) {
    return NextResponse.json({ error: "Invalid outcome" }, { status: 400 });
  }
  if (notes && notes.length > 2000) {
    return NextResponse.json({ error: "Notes are too long" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: client } = await admin.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const now = new Date();
  const { data, error } = await admin
    .from("hospitality_client_contacts")
    .insert({
      client_id: clientId,
      contacted_by: session.effectiveUserId,
      contacted_at: now.toISOString(),
      contact_month: contactMonthStart(now),
      outcome,
      notes,
    })
    .select("id, contacted_at, outcome, notes")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Could not save check-in" }, { status: 500 });
  }

  return NextResponse.json({
    contact: {
      id: data.id as string,
      contacted_at: data.contacted_at as string,
      outcome: data.outcome as string,
      outcome_label: checkInOutcomeLabel(data.outcome as string),
      notes: (data.notes as string | null) ?? null,
    },
  });
}
