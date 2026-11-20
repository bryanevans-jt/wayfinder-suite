import { formatBillableHours } from "./client-billable";

export type KraUncountedReason =
  | "out_of_scope_service"
  | "no_assignment"
  | "no_client"
  | "former_staff_caseload"
  | "other";

export type KraUncountedHoursRow = {
  reason: KraUncountedReason;
  label: string;
  billableMinutes: number;
  billableHours: string;
};

export type KraUncountedHoursBreakdown = {
  payrollOrgMinutes: number;
  payrollOrgHours: string;
  kraUniquePoolMinutes: number;
  kraUniquePoolHours: string;
  uncountedMinutes: number;
  uncountedHours: string;
  rows: KraUncountedHoursRow[];
};

const REASON_LABELS: Record<KraUncountedReason, string> = {
  out_of_scope_service: "Out-of-scope service (e.g. WRT, Job Coaching)",
  no_assignment: "No KRA roster assignment that month",
  no_client: "No client attached",
  former_staff_caseload: "Assigned only to former team members",
  other: "Other",
};

const REASON_ORDER: KraUncountedReason[] = [
  "out_of_scope_service",
  "no_assignment",
  "former_staff_caseload",
  "no_client",
  "other",
];

export type UncountedEntryClassification = {
  billableMinutes: number;
  /** True when these minutes are part of the unique in-scope KRA client pool. */
  inKraUniquePool: boolean;
  reason?: KraUncountedReason;
};

/**
 * Classify one payroll billable entry relative to the KRA unique pool.
 * Does not double-count inherited assignee hours — pool membership is client-level.
 */
export function classifyPayrollEntryForKra(opts: {
  billableMinutes: number;
  clientId: string | null | undefined;
  clientInKraScope: boolean;
  hasKraRosterAssignee: boolean;
  hasOnlyFormerStaffAssignees: boolean;
}): UncountedEntryClassification {
  const billableMinutes = Math.max(0, opts.billableMinutes || 0);
  if (billableMinutes <= 0) {
    return { billableMinutes: 0, inKraUniquePool: false };
  }
  if (!opts.clientId) {
    return { billableMinutes, inKraUniquePool: false, reason: "no_client" };
  }
  if (opts.clientInKraScope && opts.hasKraRosterAssignee) {
    return { billableMinutes, inKraUniquePool: true };
  }
  if (opts.clientInKraScope && opts.hasOnlyFormerStaffAssignees) {
    return {
      billableMinutes,
      inKraUniquePool: false,
      reason: "former_staff_caseload",
    };
  }
  if (opts.clientInKraScope) {
    return { billableMinutes, inKraUniquePool: false, reason: "no_assignment" };
  }
  return {
    billableMinutes,
    inKraUniquePool: false,
    reason: "out_of_scope_service",
  };
}

export function buildKraUncountedHoursBreakdown(
  classifications: UncountedEntryClassification[]
): KraUncountedHoursBreakdown {
  let payrollOrgMinutes = 0;
  let kraUniquePoolMinutes = 0;
  const byReason = new Map<KraUncountedReason, number>();

  for (const row of classifications) {
    if (row.billableMinutes <= 0) continue;
    payrollOrgMinutes += row.billableMinutes;
    if (row.inKraUniquePool) {
      kraUniquePoolMinutes += row.billableMinutes;
      continue;
    }
    const reason = row.reason ?? "other";
    byReason.set(reason, (byReason.get(reason) ?? 0) + row.billableMinutes);
  }

  const uncountedMinutes = Math.max(0, payrollOrgMinutes - kraUniquePoolMinutes);
  const rows: KraUncountedHoursRow[] = REASON_ORDER.filter((r) => (byReason.get(r) ?? 0) > 0).map(
    (reason) => {
      const billableMinutes = byReason.get(reason) ?? 0;
      return {
        reason,
        label: REASON_LABELS[reason],
        billableMinutes,
        billableHours: formatBillableHours(billableMinutes),
      };
    }
  );

  return {
    payrollOrgMinutes,
    payrollOrgHours: formatBillableHours(payrollOrgMinutes),
    kraUniquePoolMinutes,
    kraUniquePoolHours: formatBillableHours(kraUniquePoolMinutes),
    uncountedMinutes,
    uncountedHours: formatBillableHours(uncountedMinutes),
    rows,
  };
}
