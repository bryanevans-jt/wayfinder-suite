/** Terminal success-path stages that hide clients from active ES/counselor/supervisor lists. */
export const TERMINAL_STAGE_PATTERN = /^(closed(\s+successfully)?|dismissed)$/i;

export function isTerminalStageTitle(title: string | null | undefined): boolean {
  return TERMINAL_STAGE_PATTERN.test((title ?? "").trim());
}

export function isArchivedClient(archivedAt: string | null | undefined): boolean {
  return archivedAt != null && archivedAt.length > 0;
}
