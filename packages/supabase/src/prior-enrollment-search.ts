import { isTerminalStageTitle } from "./client-archive";

export function sanitizeClientSearchQuery(query: string): string {
  return query.trim().replace(/[%_,]/g, "");
}

/** Match display name (all query words) or email substring. */
export function clientRecordMatchesTextSearch(
  fullName: string | null | undefined,
  contactEmail: string | null | undefined,
  query: string
): boolean {
  const q = sanitizeClientSearchQuery(query).toLowerCase();
  if (q.length < 2) return false;
  const name = (fullName ?? "").toLowerCase();
  const email = (contactEmail ?? "").toLowerCase();
  if (email.includes(q)) return true;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) {
    return name.includes(tokens[0]!);
  }
  return tokens.every((t) => name.includes(t));
}

/** Same closure rules as isPriorEnrollmentClosed, without a DB round-trip. */
export function isClosedPriorEnrollmentForNewService(opts: {
  intakeStatus: string | null | undefined;
  archivedAt: string | null | undefined;
  stageTitle: string | null | undefined;
}): boolean {
  if ((opts.intakeStatus ?? "").trim().toLowerCase() === "discarded") return false;
  const archivedAt = opts.archivedAt;
  if (archivedAt != null && String(archivedAt).trim().length > 0) return true;
  return isTerminalStageTitle(opts.stageTitle);
}

export function priorEnrollmentSearchSortKey(row: {
  archived_at?: string | null;
  referred_at?: string | null;
  created_at?: string | null;
}): number {
  for (const raw of [row.archived_at, row.referred_at, row.created_at]) {
    if (raw == null || String(raw).trim() === "") continue;
    const t = Date.parse(String(raw));
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}
