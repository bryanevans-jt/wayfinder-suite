import type { ServiceActivityType } from "./es-time-tracking";

/** Contact log activity — notes only, no service time. */
export const CONTACT_LOG_NOTE_ONLY_ACTIVITY_CODE = "JT-ACT-099";

/** Intake activities that can move intake billing to ready when client was present. */
export const INTAKE_BILLING_QUALIFYING_ACTIVITY_CODES = new Set([
  "JT-ACT-001",
  "JT-ACT-002",
  "JT-INT-001",
]);

export type ClientBillableEntry = {
  duration_minutes: number;
  client_present?: boolean | null;
  delivery_mode?: string | null;
  activity_code?: string | null;
  counts_toward_client_billable?: boolean | null;
  flags?: Record<string, boolean> | null;
};

export function isGvraMonthlyAllowanceEntry(
  entry: Pick<ClientBillableEntry, "flags">
): boolean {
  return entry.flags?.gvra_monthly_admin_allowance === true;
}

export function activityCountsTowardClientBillable(
  activity: Pick<ServiceActivityType, "counts_toward_client_billable" | "code"> | null | undefined
): boolean {
  if (!activity) return true;
  if (activity.counts_toward_client_billable === false) return false;
  if (activity.code === CONTACT_LOG_NOTE_ONLY_ACTIVITY_CODE) return false;
  return true;
}

export function entryCountsTowardClientBillable(entry: ClientBillableEntry): boolean {
  if (isGvraMonthlyAllowanceEntry(entry)) return true;
  if (entry.counts_toward_client_billable === false) return false;
  return true;
}

/** Same rules as ES timesheet client billable hours (activity type + entry flags). */
export function entryCountsTowardClientBillableWithActivity(
  entry: ClientBillableEntry,
  activity:
    | Pick<ServiceActivityType, "counts_toward_client_billable" | "code">
    | { code?: string | null; counts_toward_client_billable?: boolean | null }
    | null
    | undefined
): boolean {
  if (isGvraMonthlyAllowanceEntry(entry)) return true;
  const normalized =
    activity == null
      ? null
      : {
          code: activity.code ?? "",
          counts_toward_client_billable:
            activity.counts_toward_client_billable === null
              ? undefined
              : activity.counts_toward_client_billable,
        };
  if (!activityCountsTowardClientBillable(normalized)) return false;
  if (entry.counts_toward_client_billable === false) return false;
  return true;
}

/** Active (in-person): client present and in-person delivery; excludes GVRA allowance. */
export function entryIsActiveInPerson(entry: ClientBillableEntry): boolean {
  if (isGvraMonthlyAllowanceEntry(entry)) return false;
  if (!entryCountsTowardClientBillable(entry)) return false;
  if (entry.client_present !== true) return false;
  return (entry.delivery_mode ?? "").toLowerCase() === "in_person";
}

export function sumClientBillableMinutes(entries: ClientBillableEntry[]): number {
  return entries.reduce(
    (sum, e) => sum + (entryCountsTowardClientBillable(e) ? e.duration_minutes || 0 : 0),
    0
  );
}

export function isIntakeQualifyingActivityCode(code: string | null | undefined): boolean {
  if (!code) return false;
  return INTAKE_BILLING_QUALIFYING_ACTIVITY_CODES.has(code.trim());
}

export function isNoteOnlyActivityCode(code: string | null | undefined): boolean {
  return code === CONTACT_LOG_NOTE_ONLY_ACTIVITY_CODE;
}

/** Billable hours label — one decimal place. */
export function formatBillableHours(minutes: number): string {
  if (!Number.isFinite(minutes)) return "0.0";
  return (minutes / 60).toFixed(1);
}
