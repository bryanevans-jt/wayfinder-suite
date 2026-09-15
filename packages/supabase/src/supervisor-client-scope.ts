import type { SupabaseClient } from "@supabase/supabase-js";

export type SupervisorScope = {
  supervisorUserId: string;
  officeIds: string[];
  esUserIds: string[];
};

/**
 * Regional supervisors inherit Transition Specialists in shared offices only.
 * Employment Specialists are linked explicitly (org-wide ES supervisor + any regional links).
 */
const OFFICE_SHARED_CASELOAD_ROLES = ["transition_specialist"] as const;

export async function loadSupervisorScope(
  admin: SupabaseClient,
  supervisorUserId: string
): Promise<SupervisorScope> {
  const [{ data: offices }, { data: esLinks }] = await Promise.all([
    admin.from("staff_office_assignments").select("office_id").eq("user_id", supervisorUserId),
    admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", supervisorUserId),
  ]);

  const officeIds = (offices ?? []).map((o) => o.office_id as string);
  const officeSet = new Set(officeIds);
  const esUserIds = new Set((esLinks ?? []).map((e) => e.es_user_id as string));

  if (officeIds.length > 0) {
    const { data: staffOfficeLinks } = await admin
      .from("staff_office_assignments")
      .select("user_id, office_id")
      .in("office_id", officeIds);

    const candidateUserIds = new Set<string>();
    for (const link of staffOfficeLinks ?? []) {
      const uid = link.user_id as string;
      const officeId = link.office_id as string;
      if (uid !== supervisorUserId && officeSet.has(officeId)) {
        candidateUserIds.add(uid);
      }
    }

    if (candidateUserIds.size > 0) {
      const { data: fieldProfiles } = await admin
        .from("profiles")
        .select("id")
        .in("id", [...candidateUserIds])
        .in("role", [...OFFICE_SHARED_CASELOAD_ROLES]);
      for (const profile of fieldProfiles ?? []) {
        esUserIds.add(profile.id as string);
      }
    }
  }

  return {
    supervisorUserId,
    officeIds,
    esUserIds: [...esUserIds],
  };
}

export function esUserAllowedForSupervisor(scope: SupervisorScope, esUserId: string): boolean {
  if (esUserId === scope.supervisorUserId) {
    return true;
  }
  return scope.esUserIds.includes(esUserId);
}

export async function supervisorCanAccessEs(
  admin: SupabaseClient,
  supervisorUserId: string,
  esUserId: string
): Promise<boolean> {
  const scope = await loadSupervisorScope(admin, supervisorUserId);
  return esUserAllowedForSupervisor(scope, esUserId);
}

export function officeAllowedForSupervisor(scope: SupervisorScope, officeId: string): boolean {
  return scope.officeIds.includes(officeId);
}

export async function clientInSupervisorScope(
  admin: SupabaseClient,
  scope: SupervisorScope,
  clientId: string
): Promise<boolean> {
  const { data: client } = await admin
    .from("clients")
    .select("id, office_id")
    .eq("id", clientId)
    .maybeSingle();

  if (!client) {
    return false;
  }

  if (client.office_id && scope.officeIds.includes(client.office_id as string)) {
    return true;
  }

  const { data: links } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", clientId);

  return (links ?? []).some((l) =>
    esUserAllowedForSupervisor(scope, l.es_user_id as string)
  );
}

export async function esUserAllowedForSupervisorClient(
  admin: SupabaseClient,
  scope: SupervisorScope,
  esUserId: string,
  clientId: string
): Promise<boolean> {
  if (esUserAllowedForSupervisor(scope, esUserId)) {
    return true;
  }

  if (!(await clientInSupervisorScope(admin, scope, clientId))) {
    return false;
  }

  const { data: link } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", clientId)
    .eq("es_user_id", esUserId)
    .maybeSingle();

  return Boolean(link);
}
