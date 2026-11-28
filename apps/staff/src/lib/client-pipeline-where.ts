import {
  isArchivedClient,
  isRemovedFromEsCaseload,
  isTerminalStageTitle,
} from "@wayfinder/supabase/client-archive";

export type ClientPipelineWhere =
  | "awaiting_authorization"
  | "intake"
  | "in_service"
  | "closed";

export const CLIENT_PIPELINE_WHERE_LABELS: Record<ClientPipelineWhere, string> = {
  awaiting_authorization: "Awaiting authorization",
  intake: "Intake",
  in_service: "In service",
  closed: "Closed",
};

export function clientPipelineWhere(client: {
  archived_at?: string | null;
  intake_status?: string | null;
  open_intake?: boolean;
  current_stage_id?: string | null;
  stage_title?: string | null;
}): ClientPipelineWhere {
  if (client.archived_at) return "closed";
  if (isTerminalStageTitle(client.stage_title)) return "closed";
  const intake = (client.intake_status ?? "").trim();
  if (intake === "new_referral" || intake === "pending_authorization") {
    return "awaiting_authorization";
  }
  if (client.open_intake || !client.current_stage_id) return "intake";
  return "in_service";
}

/** Admin / Super Admin portal Clients tab with default filters (not “View archived”). */
export function isDefaultPortalClientsListRow(client: {
  archived_at?: string | null;
}): boolean {
  return !isArchivedClient(client.archived_at);
}

/**
 * Team Operations Capacity caseload — same visibility as filtering Clients by
 * specialist with “View archived” off (also drops demo / discarded).
 */
export function countsTowardTeamOpsCaseload(client: {
  archived_at?: string | null;
  is_demo?: boolean | null;
  intake_status?: string | null;
}): boolean {
  if (client.is_demo) return false;
  if ((client.intake_status ?? "").trim() === "discarded") return false;
  return isDefaultPortalClientsListRow(client);
}

/**
 * Thin-contact coaching queue: exclude demo/discarded and anyone already off the
 * ES board (pending archive or fully archived).
 */
export function countsTowardThinContactCoaching(client: {
  archived_at?: string | null;
  is_demo?: boolean | null;
  intake_status?: string | null;
}): boolean {
  if (client.is_demo) return false;
  if ((client.intake_status ?? "").trim() === "discarded") return false;
  return !isRemovedFromEsCaseload(client.archived_at);
}
