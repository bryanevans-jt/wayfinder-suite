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
}): ClientPipelineWhere {
  if (client.archived_at) return "closed";
  const intake = (client.intake_status ?? "").trim();
  if (intake === "new_referral" || intake === "pending_authorization") {
    return "awaiting_authorization";
  }
  if (client.open_intake || !client.current_stage_id) return "intake";
  return "in_service";
}
