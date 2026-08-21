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

/** Active pipeline columns for caseload kanban (includes Hired with a short grace window). */
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

/** How long terminal applications may remain on the kanban after their last update. */
export const PIPELINE_TERMINAL_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Whether an application belongs on the ES kanban.
 * - Non-terminal pipeline statuses always show.
 * - Hired shows only within 24h of last update (Filled / Refused / Other never have columns).
 * - Once a client has a job start date, none of their applications show on the board.
 */
export function isApplicationVisibleOnPipelineBoard(input: {
  status: string;
  updatedAt?: string | null;
  clientHasJobStartDate?: boolean;
  now?: number;
}): boolean {
  if (input.clientHasJobStartDate) return false;

  const status = input.status.trim();
  if (!(PIPELINE_BOARD_STATUSES as readonly string[]).includes(status)) {
    return false;
  }

  if (!isTerminalApplicationStatus(status)) {
    return true;
  }

  const updated = Date.parse(input.updatedAt ?? "");
  if (Number.isNaN(updated)) return false;
  const now = input.now ?? Date.now();
  return now - updated < PIPELINE_TERMINAL_GRACE_MS;
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
