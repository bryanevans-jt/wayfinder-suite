import { isRemovedFromEsCaseload } from "@wayfinder/supabase/client-archive";
import {
  filterRetiredMarketClients,
  retiredMarketContextFromOffices,
} from "@wayfinder/supabase/retired-market";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { intakeVisibleToFieldStaff } from "@wayfinder/supabase/referral-intake";

export type EsCaseloadClientRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  full_name: string | null;
  contact_email: string | null;
  current_service_id: string | null;
  current_stage_id: string | null;
  archived_at: string | null;
  intake_status?: string | null;
  job_start_date?: string | null;
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

async function dropRetiredMarketClients(
  admin: NonNullable<ReturnType<typeof getEsCaseloadAdmin>>,
  rows: Array<
    EsCaseloadClientRow & {
      office_id?: string | null;
      referral_state?: string | null;
    }
  >
): Promise<EsCaseloadClientRow[]> {
  if (rows.length === 0) {
    return rows;
  }
  const [{ data: offices }, { data: services }] = await Promise.all([
    admin.from("offices").select("id, state, name"),
    admin.from("services").select("id, name, state"),
  ]);
  const ctx = retiredMarketContextFromOffices(
    (offices ?? []).map((o) => ({
      id: o.id as string,
      state: o.state as string | null,
      name: o.name as string | null,
    }))
  );
  const servicesById = new Map(
    (services ?? []).map((s) => [
      s.id as string,
      { state: s.state as string | null, name: s.name as string | null },
    ])
  );
  return filterRetiredMarketClients(rows, ctx, servicesById) as EsCaseloadClientRow[];
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
      "id, user_id, profile_id, full_name, contact_email, current_service_id, current_stage_id, archived_at, intake_status, job_start_date, office_id, referral_state"
    )
    .in("id", clientIds);

  // Older databases may lack roster / archive / job_start_date columns; retry without them.
  if (
    clientsErr?.message.includes("archived_at") ||
    clientsErr?.message.includes("full_name") ||
    clientsErr?.message.includes("job_start_date")
  ) {
    const fallback = await admin
      .from("clients")
      .select("id, user_id, profile_id, contact_email, current_service_id, current_stage_id")
      .in("id", clientIds);
    if (fallback.error) {
      return { clients: [], error: fallback.error.message };
    }
    const rows = (fallback.data ?? []).map((c) => ({
      ...(c as Omit<EsCaseloadClientRow, "archived_at" | "full_name" | "job_start_date">),
      full_name: null,
      archived_at: null,
      job_start_date: null,
    })) as EsCaseloadClientRow[];
    let clients = includeArchived
      ? rows
      : rows.filter(
          (c) =>
            !isRemovedFromEsCaseload(c.archived_at) &&
            intakeVisibleToFieldStaff((c as EsCaseloadClientRow).intake_status)
        );
    clients = await dropRetiredMarketClients(admin, clients);
    return { clients, error: null };
  }

  if (clientsErr) {
    return { clients: [], error: clientsErr.message };
  }

  const rows = (clientRows ?? []) as EsCaseloadClientRow[];
  let clients = includeArchived
    ? rows
    : rows.filter(
        (c) =>
          !isRemovedFromEsCaseload(c.archived_at) &&
          intakeVisibleToFieldStaff(c.intake_status)
      );

  clients = await dropRetiredMarketClients(admin, clients);

  return { clients, error: null };
}
