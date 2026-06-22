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
  const [{ data: offices }, { data: esLinks }] = await Promise.all([
    admin.from("staff_office_assignments").select("office_id").eq("user_id", supervisorUserId),
    admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", supervisorUserId),
  ]);

  return {
    supervisorUserId,
    officeIds: (offices ?? []).map((o) => o.office_id as string),
    esUserIds: (esLinks ?? []).map((e) => e.es_user_id as string),
  };
}

export function esUserAllowedForSupervisor(scope: SupervisorScope, esUserId: string): boolean {
  if (esUserId === scope.supervisorUserId) {
    return true;
  }
  if (scope.esUserIds.includes(esUserId)) {
    return true;
  }
  return false;
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
