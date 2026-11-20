import { formatBillableHours } from "@wayfinder/supabase/client-billable";
import { isStaffRole } from "@wayfinder/supabase/roles";

export type OrgBillableRosterStatus = "active" | "former" | "needs_review";

export type OrgMonthlyBillableHoursRow = {
  staffUserId: string;
  staffName: string;
  billableMinutes: number;
  billableHours: string;
  rosterStatus: OrgBillableRosterStatus;
};

export type OrgBillableLoggerProfile = {
  role: string | null | undefined;
  isActive: boolean | null | undefined;
  displayName: string;
};

const STATUS_SORT: Record<OrgBillableRosterStatus, number> = {
  active: 0,
  former: 1,
  needs_review: 2,
};

/** Classify a time-entry logger relative to the live payroll roster. */
export function classifyOrgBillableLogger(opts: {
  onLiveRoster: boolean;
  role: string | null | undefined;
  isActive?: boolean | null | undefined;
}): OrgBillableRosterStatus {
  if (opts.onLiveRoster) return "active";
  if (!isStaffRole(opts.role)) return "needs_review";
  return "former";
}

/** Display label for the monthly payroll panel. */
export function formatOrgBillableStaffLabel(
  name: string,
  status: OrgBillableRosterStatus
): string {
  const trimmed = name.trim();
  if (status === "former") {
    return trimmed ? `${trimmed} (Former)` : "Former team member";
  }
  if (status === "needs_review") {
    return trimmed ? `${trimmed} (Unassigned / needs review)` : "Unassigned / needs review";
  }
  return trimmed || "Team member";
}

/**
 * Demo clients (is_demo = true) are excluded from org payroll rollups,
 * per-staff billable totals, and billable exports. Entries with no client still count.
 */
export function countsTowardBillableHoursTotals(opts: {
  clientId: string | null | undefined;
  clientIsDemo?: boolean | null;
}): boolean {
  if (opts.clientId == null || opts.clientId === "") return true;
  return opts.clientIsDemo !== true;
}

/**
 * Build monthly payroll rows: every logger with billable minutes in the month
 * (including deactivated / non-staff), plus live-roster team members at 0 hours.
 */
export function buildOrgMonthlyBillableHoursRows(opts: {
  liveRoster: Array<{ id: string; name: string }>;
  minutesByUserId: Map<string, number>;
  profileById: Map<string, OrgBillableLoggerProfile>;
}): OrgMonthlyBillableHoursRow[] {
  const liveIds = new Set(opts.liveRoster.map((s) => s.id));
  const liveNameById = new Map(opts.liveRoster.map((s) => [s.id, s.name]));
  const userIds = new Set<string>([...liveIds, ...opts.minutesByUserId.keys()]);

  const rows: OrgMonthlyBillableHoursRow[] = [];
  for (const staffUserId of userIds) {
    const billableMinutes = opts.minutesByUserId.get(staffUserId) ?? 0;
    const onLiveRoster = liveIds.has(staffUserId);
    // Live roster is the only source of zero-hour rows.
    if (!onLiveRoster && billableMinutes <= 0) continue;

    const profile = opts.profileById.get(staffUserId);
    const rosterStatus = classifyOrgBillableLogger({
      onLiveRoster,
      role: profile?.role,
      isActive: profile?.isActive,
    });
    const baseName =
      liveNameById.get(staffUserId) ??
      profile?.displayName?.trim() ??
      "Team member";

    rows.push({
      staffUserId,
      staffName: formatOrgBillableStaffLabel(baseName, rosterStatus),
      billableMinutes,
      billableHours: formatBillableHours(billableMinutes),
      rosterStatus,
    });
  }

  return rows.sort((a, b) => {
    const statusCmp = STATUS_SORT[a.rosterStatus] - STATUS_SORT[b.rosterStatus];
    if (statusCmp !== 0) return statusCmp;
    return a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" });
  });
}
