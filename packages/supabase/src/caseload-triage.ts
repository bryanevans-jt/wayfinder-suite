export type CaseloadTriageFlag =
  | "no_contact"
  | "stale_application"
  | "meeting_pending"
  | "se_monthly_due";

export const TRIAGE_FLAG_META: Record<
  CaseloadTriageFlag,
  { label: string; shortLabel: string; priority: number }
> = {
  no_contact: { label: "No contact in 14+ days", shortLabel: "Contact", priority: 1 },
  stale_application: {
    label: "Application stale 14+ days",
    shortLabel: "Application",
    priority: 2,
  },
  meeting_pending: { label: "Meeting awaiting response", shortLabel: "Meeting", priority: 3 },
  se_monthly_due: { label: "SE Monthly due", shortLabel: "Report", priority: 4 },
};

export const NO_CONTACT_DAYS = 14;
export const STALE_APPLICATION_DAYS = 14;
export const MIN_CONTACTS_PER_MONTH = 4;

export function triageAttentionScore(flags: CaseloadTriageFlag[]): number {
  if (flags.length === 0) return 0;
  return flags.reduce((sum, f) => sum + (10 - TRIAGE_FLAG_META[f].priority), 0);
}

export function sortClientsByTriage<T extends { id: string; name: string }>(
  clients: T[],
  flagsByClient: Map<string, CaseloadTriageFlag[]>
): T[] {
  return [...clients].sort((a, b) => {
    const scoreA = triageAttentionScore(flagsByClient.get(a.id) ?? []);
    const scoreB = triageAttentionScore(flagsByClient.get(b.id) ?? []);
    if (scoreA !== scoreB) return scoreB - scoreA;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
}
