import { localDateStringInTz, STAFF_CLOCK_TIMEZONE, canUseStaffClock } from "./staff-time-clock-shared";
import {
  isAdminTierRole,
  isEsRole,
  isHrRole,
  isInstructorRole,
  isSupervisorRole,
  normalizeRole,
} from "./roles";

export const PTO_REASONS = [
  "vacation",
  "sick",
  "maternity",
  "paternity",
  "emergency",
  "other",
] as const;

/** Reasons shown in the request form (maternity/paternity combined as one option). */
export const PTO_FORM_REASONS = [
  "vacation",
  "sick",
  "maternity",
  "emergency",
  "other",
] as const;

export type PtoReason = (typeof PTO_REASONS)[number];
export type PtoFormReason = (typeof PTO_FORM_REASONS)[number];

/**
 * pending_supervisor = awaiting supervisor coverage OK (ES / Instructor)
 * pending = awaiting HR/admin final decision
 * approved only after HR/admin
 */
export const PTO_STATUSES = [
  "pending_supervisor",
  "pending",
  "approved",
  "denied",
  "cancelled",
] as const;
export type PtoStatus = (typeof PTO_STATUSES)[number];

export const PTO_OPEN_STATUSES: PtoStatus[] = ["pending_supervisor", "pending"];

export type OrgPtoSettingsRow = {
  id: string;
  period_start_date: string;
  annual_pto_days: number | null;
  updated_at: string;
  updated_by: string | null;
};

export type StaffPtoRequestRow = {
  id: string;
  requester_user_id: string;
  start_date: string;
  end_date: string;
  reason: PtoReason;
  details: string | null;
  days_charged: number;
  days_charged_manual: boolean;
  status: PtoStatus;
  decision_notes: string | null;
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
  updated_at: string;
};

/** PTO for Time Clock users (ES, supervisor, HR, accountant, hospitality, admin). Not counselors/clients/supports. */
export function canUseStaffPto(role: string | null | undefined): boolean {
  return canUseStaffClock(role);
}

/** @deprecated Use canUseStaffPto — kept so older imports keep working during rollout. */
export function isPtoPreviewUnlocked(role: string | null | undefined): boolean {
  return canUseStaffPto(role);
}

export function canApproveStaffPto(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isHrRole(role);
}

/** Supervisor coverage OK before HR (ES / Instructor requests only). */
export function canSupervisorAdvanceStaffPto(role: string | null | undefined): boolean {
  return isSupervisorRole(role);
}

export function canManageStaffPtoSettings(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isHrRole(role);
}

/** See every team member’s requests (view-only for accountant). */
export function canViewAllStaffPto(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return isAdminTierRole(r) || isHrRole(r) || r === "accountant";
}

/** Supervisors see designated ES/Instructor requests (assignments only). */
export function canViewDesignatedEsPto(role: string | null | undefined): boolean {
  return isSupervisorRole(role);
}

/**
 * ES and Instructors route through supervisor first.
 * Supervisors, admins, HR, and other roles go straight to HR (`pending`).
 * (Retired Transition Specialist role maps to ES.)
 */
export function ptoNeedsSupervisorFirst(role: string | null | undefined): boolean {
  return isEsRole(role) || isInstructorRole(role);
}

export function isOpenPtoStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "pending_supervisor";
}

export function ptoStatusLabel(status: string): string {
  switch (status) {
    case "pending_supervisor":
      return "Awaiting supervisor";
    case "pending":
      return "Awaiting HR";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
}

export function todayEasternDateString(now: Date = new Date()): string {
  return localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
}

/** Inclusive Mon–Fri count between ISO date strings (YYYY-MM-DD). */
export function countBusinessDaysInclusive(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) {
    return 0;
  }
  const start = parseIsoDateLocal(startDate);
  const end = parseIsoDateLocal(endDate);
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function parseIsoDateLocal(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

export function addDaysIso(iso: string, days: number): string {
  const d = parseIsoDateLocal(iso);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Current PTO period: [periodStart, periodStart + 1 year).
 * If today is before this year's anniversary of period_start_date, use previous cycle.
 */
export function resolvePtoPeriodWindow(
  periodStartDate: string,
  todayIso: string = todayEasternDateString()
): { start: string; endExclusive: string; endInclusive: string } {
  const anchor = parseIsoDateLocal(periodStartDate);
  const today = parseIsoDateLocal(todayIso);
  let year = today.getFullYear();
  let start = new Date(year, anchor.getMonth(), anchor.getDate());
  if (today < start) {
    year -= 1;
    start = new Date(year, anchor.getMonth(), anchor.getDate());
  }
  const endExclusive = new Date(year + 1, anchor.getMonth(), anchor.getDate());
  const endInclusive = new Date(endExclusive);
  endInclusive.setDate(endInclusive.getDate() - 1);

  return {
    start: formatLocalDate(start),
    endExclusive: formatLocalDate(endExclusive),
    endInclusive: formatLocalDate(endInclusive),
  };
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ptoReasonLabel(reason: string): string {
  switch (reason) {
    case "vacation":
      return "Vacation";
    case "sick":
      return "Sick";
    case "maternity":
    case "paternity":
      return "Maternity/Paternity";
    case "emergency":
      return "Emergency";
    case "other":
      return "Other";
    default:
      return reason;
  }
}

export function isValidPtoReason(value: string): value is PtoReason {
  return (PTO_REASONS as readonly string[]).includes(value);
}
