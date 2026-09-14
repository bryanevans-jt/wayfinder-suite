import type { SupabaseClient } from "@supabase/supabase-js";
import { buildClientActivityInsertFkIds } from "./client-activity-fk";

export function isIndividualJobPlacementServiceName(
  serviceName: string | null | undefined
): boolean {
  return /individual job placement|\bijp\b/i.test((serviceName ?? "").trim());
}

function isTerminalIjpStageTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim().toLowerCase();
  return /^(closed(\s+successfully)?|dismissed|services\s+interrupted|on hold)$/.test(t);
}

async function findMilestoneIdByTitle(
  admin: SupabaseClient,
  serviceId: string,
  titleMatch: RegExp
): Promise<string | null> {
  const { data: rows } = await admin
    .from("service_milestones")
    .select("id, title")
    .eq("service_id", serviceId)
    .order("order_index", { ascending: true });

  for (const row of rows ?? []) {
    const title = String(row.title ?? "");
    if (titleMatch.test(title.trim())) {
      return row.id as string;
    }
  }
  return null;
}

async function clientHasHiredApplication(
  admin: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientRow) return false;

  const fkIds = buildClientActivityInsertFkIds(clientRow);
  const { data: apps } = await admin
    .from("applications")
    .select("id, status")
    .in("client_id", fkIds)
    .limit(20);

  return (apps ?? []).some((a) => (a.status as string | null)?.trim().toLowerCase() === "hired");
}

/**
 * Move IJP clients to the Working milestone after hire (job start date and/or Hired application).
 */
export async function advanceIjpClientToWorkingAfterHire(
  admin: SupabaseClient,
  clientId: string
): Promise<boolean> {
  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("id, current_service_id, current_stage_id, job_start_date, archived_at")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client?.current_service_id || client.archived_at) {
    return false;
  }

  const jobStart = (client.job_start_date as string | null)?.trim();
  const hasHiredApp = await clientHasHiredApplication(admin, clientId);
  if (!jobStart && !hasHiredApp) {
    return false;
  }

  const { data: service } = await admin
    .from("services")
    .select("name")
    .eq("id", client.current_service_id as string)
    .maybeSingle();

  if (!isIndividualJobPlacementServiceName(service?.name as string | undefined)) {
    return false;
  }

  const workingId = await findMilestoneIdByTitle(
    admin,
    client.current_service_id as string,
    /^working$/i
  );
  if (!workingId) {
    return false;
  }

  if (client.current_stage_id === workingId) {
    return false;
  }

  if (client.current_stage_id) {
    const { data: current } = await admin
      .from("service_milestones")
      .select("title")
      .eq("id", client.current_stage_id as string)
      .maybeSingle();
    const currentTitle = String(current?.title ?? "");
    if (isTerminalIjpStageTitle(currentTitle)) {
      return false;
    }
    if (/^working$/i.test(currentTitle.trim())) {
      return false;
    }
  }

  const { error: updErr } = await admin
    .from("clients")
    .update({
      current_stage_id: workingId,
      last_activity_at: new Date().toISOString(),
    })
    .eq("id", clientId);

  return !updErr;
}
