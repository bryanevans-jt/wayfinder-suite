import { isArchivedClient, isTerminalStageTitle } from "@wayfinder/supabase/client-archive";

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
