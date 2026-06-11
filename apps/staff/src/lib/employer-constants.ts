export const EMPLOYER_STATUSES = [
  "active",
  "inactive",
  "prospect",
  "pending_review",
] as const;

export type EmployerStatus = (typeof EMPLOYER_STATUSES)[number];

export const EMPLOYER_STATUS_LABELS: Record<EmployerStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  prospect: "Prospect",
  pending_review: "Pending review",
};

export const COMMUNITY_PARTNERS_NETWORK_NAME = "Community Partners Network";

export function employerStatusLabel(status: string | null | undefined): string {
  const key = (status ?? "").trim().toLowerCase();
  return EMPLOYER_STATUS_LABELS[key as EmployerStatus] ?? status ?? "—";
}

export function employerStatusBadgeClass(status: string): string {
  if (status === "active") return "bg-brand-green/15 text-brand-green";
  if (status === "prospect") return "bg-brand-gold/20 text-brand-black";
  if (status === "pending_review") return "bg-amber-100 text-amber-900";
  return "bg-neutral-200 text-brand-black/70";
}

export function isEmployerStatus(value: string): value is EmployerStatus {
  return (EMPLOYER_STATUSES as readonly string[]).includes(value);
}
