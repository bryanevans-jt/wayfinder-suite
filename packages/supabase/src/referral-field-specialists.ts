import type { SupabaseClient } from "@supabase/supabase-js";
import { isFieldSpecialistRole, isSupervisorRole } from "./roles";

function isCaseloadAssigneeRole(role: string): boolean {
  return isFieldSpecialistRole(role) || isSupervisorRole(role);
}

export type FieldSpecialistOptionGroup = "office_es" | "office_ts" | "other";

export type FieldSpecialistOption = {
  userId: string;
  fullName: string;
  role: "es" | "transition_specialist" | "supervisor";
  group: FieldSpecialistOptionGroup;
};

const ASSIGNEE_ROLES = ["es", "transition_specialist", "supervisor"] as const;

function displayName(fullName: string | null | undefined, email: string | null | undefined): string {
  const name = (fullName ?? "").trim();
  if (name) return name;
  return (email ?? "").trim() || "Staff";
}

function roleSortRank(role: string): number {
  if (role === "es") return 0;
  if (role === "transition_specialist") return 1;
  return 2;
}

/** Staff pickers for Referral Queue: office ES, office TS, then all other field specialists + supervisors. */
export async function loadReferralFieldSpecialistOptions(
  admin: SupabaseClient,
  officeId: string | null | undefined
): Promise<FieldSpecialistOption[]> {
  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .in("role", [...ASSIGNEE_ROLES])
    .eq("is_active", true);

  if (error) {
    console.error("loadReferralFieldSpecialistOptions profiles:", error.message);
    return [];
  }

  const officeStaff = new Set<string>();
  const normalizedOffice = (officeId ?? "").trim();
  if (normalizedOffice) {
    const { data: links } = await admin
      .from("staff_office_assignments")
      .select("user_id")
      .eq("office_id", normalizedOffice);
    for (const row of links ?? []) {
      officeStaff.add(row.user_id as string);
    }
  }

  const options: FieldSpecialistOption[] = [];

  for (const row of profiles ?? []) {
    const role = String(row.role ?? "").toLowerCase();
    if (!isCaseloadAssigneeRole(role)) continue;

    const userId = row.id as string;
    const inOffice = officeStaff.has(userId);
    let group: FieldSpecialistOptionGroup = "other";
    if (inOffice && role === "es") group = "office_es";
    else if (inOffice && role === "transition_specialist") group = "office_ts";

    options.push({
      userId,
      fullName: displayName(row.full_name as string | null, null),
      role: role as FieldSpecialistOption["role"],
      group,
    });
  }

  options.sort((a, b) => {
    const groupOrder: Record<FieldSpecialistOptionGroup, number> = {
      office_es: 0,
      office_ts: 1,
      other: 2,
    };
    const g = groupOrder[a.group] - groupOrder[b.group];
    if (g !== 0) return g;
    const r = roleSortRank(a.role) - roleSortRank(b.role);
    if (r !== 0) return r;
    return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
  });

  return options;
}

export async function loadDirectReferralAssignEnabled(admin: SupabaseClient): Promise<boolean> {
  const { data, error } = await admin
    .from("admin_config")
    .select("direct_referral_assign_enabled")
    .limit(1)
    .maybeSingle();
  if (error?.message.includes("direct_referral_assign")) {
    return false;
  }
  return data?.direct_referral_assign_enabled === true;
}

/** Prefer client's office supervisor link, then any active supervisor on supervisor_es_assignments. */
export async function resolveSupervisorUserIdForFieldSpecialist(
  admin: SupabaseClient,
  fieldSpecialistUserId: string,
  clientOfficeId?: string | null
): Promise<string | null> {
  const { data: links } = await admin
    .from("supervisor_es_assignments")
    .select("supervisor_user_id")
    .eq("es_user_id", fieldSpecialistUserId);

  const supervisorIds = [
    ...new Set((links ?? []).map((r) => r.supervisor_user_id as string).filter(Boolean)),
  ];
  if (supervisorIds.length === 0) return null;

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .in("id", supervisorIds);

  const activeSupervisors = (profiles ?? []).filter(
    (p) => p.role === "supervisor" && p.is_active !== false
  );
  if (activeSupervisors.length === 0) return null;

  const officeId = (clientOfficeId ?? "").trim();
  if (officeId) {
    const { data: officeLinks } = await admin
      .from("staff_office_assignments")
      .select("user_id")
      .eq("office_id", officeId)
      .in(
        "user_id",
        activeSupervisors.map((p) => p.id as string)
      );
    const inOffice = (officeLinks ?? []).map((r) => r.user_id as string);
    if (inOffice.length === 1) return inOffice[0]!;
    if (inOffice.length > 1) return inOffice[0]!;
  }

  return activeSupervisors[0]!.id as string;
}

export function fieldSpecialistRoleLabel(role: string | null | undefined): "ES" | "TS" {
  return role === "transition_specialist" ? "TS" : "ES";
}

export async function assignReferralFieldSpecialist(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    fieldSpecialistUserId: string;
    actorUserId: string;
  }
): Promise<{ ok: true } | { error: string }> {
  const specialistId = opts.fieldSpecialistUserId.trim();
  if (!specialistId) {
    return { error: "Select an Employment or Transition Specialist." };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role, is_active, full_name")
    .eq("id", specialistId)
    .maybeSingle();

  if (!profile?.is_active) {
    return { error: "Field specialist not found." };
  }

  const role = String(profile.role ?? "").toLowerCase();
  if (!isFieldSpecialistRole(role) && !isSupervisorRole(role)) {
    return { error: "Caseload can only be assigned to an ES, TS, or supervisor." };
  }

  const { data: client } = await admin
    .from("clients")
    .select("office_id")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!client) return { error: "Client not found" };

  const { error: clearErr } = await admin
    .from("es_client_assignments")
    .delete()
    .eq("client_id", opts.clientId);
  if (clearErr) return { error: clearErr.message };

  const { error: assignErr } = await admin.from("es_client_assignments").insert({
    es_user_id: specialistId,
    client_id: opts.clientId,
  });
  if (assignErr) return { error: assignErr.message };

  await admin
    .from("client_message_threads")
    .update({ current_es_user_id: specialistId })
    .eq("client_id", opts.clientId);

  const supervisorId = await resolveSupervisorUserIdForFieldSpecialist(
    admin,
    specialistId,
    client.office_id as string | null
  );

  if (supervisorId) {
    const { error: supErr } = await admin
      .from("clients")
      .update({ supervisor_user_id: supervisorId, last_activity_at: new Date().toISOString() })
      .eq("id", opts.clientId);
    if (supErr && !/supervisor_user_id|does not exist|schema cache/i.test(supErr.message)) {
      return { error: supErr.message };
    }
  }

  await admin.from("client_intake_events").insert({
    client_id: opts.clientId,
    actor_user_id: opts.actorUserId,
    event_type: "referral_specialist_assigned",
    to_value: specialistId,
    metadata: { supervisorUserId: supervisorId },
  });

  const { healReferralPipelineMarkersForClient } = await import("./referral-intake");
  await healReferralPipelineMarkersForClient(admin, opts.clientId).catch(() => undefined);

  return { ok: true };
}
