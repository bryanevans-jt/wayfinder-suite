export const APPLICATION_STATUSES = [
  "Applied",
  "Interview Scheduled",
  "Interview Complete",
  "Offer",
  "Hired",
  "Filled",
  "Refused by Client",
  "Other",
] as const;

/** Active pipeline columns for caseload kanban (excludes terminal statuses). */
export const PIPELINE_BOARD_STATUSES = [
  "Applied",
  "Interview Scheduled",
  "Interview Complete",
  "Offer",
  "Hired",
] as const;

export type PipelineBoardStatus = (typeof PIPELINE_BOARD_STATUSES)[number];

export function isPipelineBoardStatus(value: string): value is PipelineBoardStatus {
  return (PIPELINE_BOARD_STATUSES as readonly string[]).includes(value);
}

export function isTerminalApplicationStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "filled" || s === "refused by client" || s === "other" || s === "hired";
}

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}

export function applicationStatusLabel(status: string | null | undefined): string {
  return status?.trim() || "—";
}

export function isGoldApplicationStatus(status: string | null | undefined): boolean {
  const s = (status ?? "").trim().toLowerCase();
  return s === "hired";
}
