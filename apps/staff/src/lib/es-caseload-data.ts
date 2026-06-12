import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export type EsCaseloadClientRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  contact_email: string | null;
  current_service_id: string | null;
  current_stage_id: string | null;
};

export function getEsCaseloadAdmin() {
  try {
    return createServiceRoleClient();
  } catch {
    return null;
  }
}

export async function esIsAssignedToClient(esUserId: string, clientId: string): Promise<boolean> {
  const admin = getEsCaseloadAdmin();
  if (!admin) {
    return false;
  }

  const { data } = await admin
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", esUserId)
    .eq("client_id", clientId)
    .maybeSingle();

  return Boolean(data);
}

export async function fetchEsCaseloadClients(
  esUserId: string
): Promise<{ clients: EsCaseloadClientRow[]; error: string | null }> {
  const admin = getEsCaseloadAdmin();
  if (!admin) {
    return { clients: [], error: "Server configuration error" };
  }

  const { data: links, error: linksErr } = await admin
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", esUserId);

  if (linksErr) {
    return { clients: [], error: linksErr.message };
  }

  const clientIds = (links ?? []).map((l) => l.client_id as string).filter(Boolean);
  if (clientIds.length === 0) {
    return { clients: [], error: null };
  }

  const { data: clientRows, error: clientsErr } = await admin
    .from("clients")
    .select("id, user_id, profile_id, contact_email, current_service_id, current_stage_id")
    .in("id", clientIds);

  if (clientsErr) {
    return { clients: [], error: clientsErr.message };
  }

  return { clients: (clientRows ?? []) as EsCaseloadClientRow[], error: null };
}
