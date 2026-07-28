/** Terminal success-path stages that schedule archive and leave ES active caseload. */
export const TERMINAL_STAGE_PATTERN = /^(closed(\s+successfully)?|dismissed)$/i;

export function isTerminalStageTitle(title: string | null | undefined): boolean {
  return TERMINAL_STAGE_PATTERN.test((title ?? "").trim());
}

/**
 * Fully archived: scheduled archive time has passed (hidden from ES / supervisor /
 * counselor default lists).
 */
export function isArchivedClient(
  archivedAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (archivedAt == null || archivedAt.length === 0) return false;
  const t = Date.parse(archivedAt);
  return !Number.isNaN(t) && t <= nowMs;
}

/** Closed/Dismissed but still within the 24h grace window. */
export function isPendingArchive(
  archivedAt: string | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (archivedAt == null || archivedAt.length === 0) return false;
  const t = Date.parse(archivedAt);
  return !Number.isNaN(t) && t > nowMs;
}

/**
 * Off the ES active caseload as soon as Closed/Dismissed is saved
 * (pending or fully archived).
 */
export function isRemovedFromEsCaseload(archivedAt: string | null | undefined): boolean {
  return archivedAt != null && archivedAt.length > 0;
}

export function archiveWarningMessage(archiveAtIso: string | null | undefined): string {
  if (!archiveAtIso) {
    return "This client will leave your active caseload now and will be archived in 24 hours.";
  }
  const when = new Date(archiveAtIso);
  if (Number.isNaN(when.getTime())) {
    return "This client will leave your active caseload now and will be archived in 24 hours.";
  }
  return `This client will leave your active caseload now and will be archived on ${when.toLocaleString()}. After that they will no longer appear on Employment Specialist, supervisor, or counselor lists unless “View archived” is on.`;
}
