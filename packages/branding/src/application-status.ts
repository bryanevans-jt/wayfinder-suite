export const APPLICATION_STATUSES = [
  "Applied",
  "Interview Scheduled",
  "Interview Complete",
  "Hired",
  "Filled",
  "Refused by Client",
  "Other",
] as const;

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
