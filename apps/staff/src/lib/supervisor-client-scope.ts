import type { SupabaseClient } from "@supabase/supabase-js";

export type SupervisorScope = {
  supervisorUserId: string;
  officeIds: string[];
  esUserIds: string[];
};

export async function loadSupervisorScope(
  admin: SupabaseClient,
  supervisorUserId: string
): Promise<SupervisorScope> {
  const [{ data: offices }, { data: esLinks }, { data: staffOfficeLinks }, { data: esProfiles }] =
    await Promise.all([
      admin.from("staff_office_assignments").select("office_id").eq("user_id", supervisorUserId),
      admin
        .from("supervisor_es_assignments")
        .select("es_user_id")
        .eq("supervisor_user_id", supervisorUserId),
      admin.from("staff_office_assignments").select("user_id, office_id"),
      admin.from("profiles").select("id").eq("role", "es"),
    ]);

  const officeIds = (offices ?? []).map((o) => o.office_id as string);
  const officeSet = new Set(officeIds);
  const esUserIds = new Set((esLinks ?? []).map((e) => e.es_user_id as string));

  const officesByUser = new Map<string, string[]>();
  for (const link of staffOfficeLinks ?? []) {
    const uid = link.user_id as string;
    const list = officesByUser.get(uid) ?? [];
    list.push(link.office_id as string);
    officesByUser.set(uid, list);
  }

  for (const profile of esProfiles ?? []) {
    const id = profile.id as string;
    if ((officesByUser.get(id) ?? []).some((officeId) => officeSet.has(officeId))) {
      esUserIds.add(id);
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

/** ES on a client the supervisor may manage — including the client's current assignment. */
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
