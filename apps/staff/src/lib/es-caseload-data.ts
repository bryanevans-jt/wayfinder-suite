import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export type EsCaseloadClientRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  full_name: string | null;
  contact_email: string | null;
  current_service_id: string | null;
  current_stage_id: string | null;
  archived_at: string | null;
};

export type FetchEsCaseloadOptions = {
  includeArchived?: boolean;
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
  esUserId: string,
  options: FetchEsCaseloadOptions = {}
): Promise<{ clients: EsCaseloadClientRow[]; error: string | null }> {
  const { includeArchived = false } = options;
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
    .select(
      "id, user_id, profile_id, full_name, contact_email, current_service_id, current_stage_id, archived_at"
    )
    .in("id", clientIds);

  // Older databases may lack the roster full_name and/or archived_at columns; retry without them.
  if (
    clientsErr?.message.includes("archived_at") ||
    clientsErr?.message.includes("full_name")
  ) {
    const fallback = await admin
      .from("clients")
      .select("id, user_id, profile_id, contact_email, current_service_id, current_stage_id")
      .in("id", clientIds);
    if (fallback.error) {
      return { clients: [], error: fallback.error.message };
    }
    const rows = (fallback.data ?? []).map((c) => ({
      ...(c as Omit<EsCaseloadClientRow, "archived_at" | "full_name">),
      full_name: null,
      archived_at: null,
    })) as EsCaseloadClientRow[];
    const clients = includeArchived ? rows : rows.filter((c) => c.archived_at == null);
    return { clients, error: null };
  }

  if (clientsErr) {
    return { clients: [], error: clientsErr.message };
  }

  const rows = (clientRows ?? []) as EsCaseloadClientRow[];
  const clients = includeArchived
    ? rows
    : rows.filter((c) => c.archived_at == null);

  return { clients, error: null };
}
