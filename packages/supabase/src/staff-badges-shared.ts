import { NO_CONTACT_DAYS } from "./caseload-triage";
import {
  ASSIGNMENT_HISTORY_BACKFILL_DAY,
  assigneeOnCalendarDate,
  calendarMonthBoundsFromKey,
  type AssignmentEventRow,
} from "./es-client-assignment-events";

export { ASSIGNMENT_HISTORY_BACKFILL_DAY, assigneeOnCalendarDate };

/** Minimum caseload / in-scope clients required for contact and KRA % badges. */
export const STAFF_BADGE_MIN_CLIENTS = 3;

export const PLACEMENT_MONTH_TIERS = [1, 2, 3] as const;
export const KRA_PERCENT_TIERS = [50, 75, 100] as const;
export const CAREER_PLACEMENT_TIERS = [25, 50, 100] as const;

export type StaffBadgeKey =
  | `placements_${(typeof PLACEMENT_MONTH_TIERS)[number]}`
  | `kra_${(typeof KRA_PERCENT_TIERS)[number]}`
  | "every_client_contacted"
  | "no_14_day_gaps"
  | "first_placement"
  | `career_placements_${(typeof CAREER_PLACEMENT_TIERS)[number]}`
  | "personal_best";

export type StaffBadgeProgress = {
  badgeKey: StaffBadgeKey | string;
  label: string;
  description: string;
  earned: boolean;
  /** 0–1 progress toward this badge in the current evaluation window. */
  progress: number;
  detail?: string;
};

export type StaffBadgeStreakSummary = {
  kind: "kra" | "placements";
  label: string;
  current: number;
  best: number;
};

export function placementBadgeKey(tier: number): StaffBadgeKey {
  return `placements_${tier}` as StaffBadgeKey;
}

export function kraBadgeKey(tier: number): StaffBadgeKey {
  return `kra_${tier}` as StaffBadgeKey;
}

export function careerPlacementBadgeKey(tier: number): StaffBadgeKey {
  return `career_placements_${tier}` as StaffBadgeKey;
}

export function monthKeysInclusive(fromKey: string, toKey: string): string[] {
  const out: string[] = [];
  let [y, m] = fromKey.split("-").map(Number);
  const [ty, tm] = toKey.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

export function previousMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

/** Add (or subtract) calendar days to a YYYY-MM-DD string (UTC date arithmetic). */
export function addCalendarDays(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export function daysBetweenYmd(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const aMs = Date.UTC(ay, am - 1, ad, 12);
  const bMs = Date.UTC(by, bm - 1, bd, 12);
  return Math.round((bMs - aMs) / 86_400_000);
}

/**
 * Placement credit for a job start: assignee on job_start_date.
 * Before {@link ASSIGNMENT_HISTORY_BACKFILL_DAY}, uses earliest known assignment.
 */
export function creditPlacementToStaff(
  events: AssignmentEventRow[],
  jobStartDate: string,
  staffUserId: string
): boolean {
  const day = jobStartDate.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  return assigneeOnCalendarDate(events, day) === staffUserId;
}

export function countPlacementsInMonth(input: {
  staffUserId: string;
  monthKey: string;
  /** clientId → job_start_date (YYYY-MM-DD) */
  jobStarts: Map<string, string>;
  eventsByClient: Map<string, AssignmentEventRow[]>;
}): number {
  const { start, end } = calendarMonthBoundsFromKey(input.monthKey);
  let count = 0;
  for (const [clientId, jobStart] of input.jobStarts) {
    const day = jobStart.trim().slice(0, 10);
    if (day < start || day > end) continue;
    const events = input.eventsByClient.get(clientId) ?? [];
    if (creditPlacementToStaff(events, day, input.staffUserId)) {
      count += 1;
    }
  }
  return count;
}

export function kraPercentMet(metCount: number, inScopeClientCount: number): number {
  if (inScopeClientCount <= 0) return 0;
  return (metCount / inScopeClientCount) * 100;
}

export function kraTiersEarned(
  metCount: number,
  inScopeClientCount: number
): number[] {
  if (inScopeClientCount < STAFF_BADGE_MIN_CLIENTS) return [];
  const pct = kraPercentMet(metCount, inScopeClientCount);
  return KRA_PERCENT_TIERS.filter((t) => pct + 1e-9 >= t);
}

export function placementTiersEarned(placementCount: number): number[] {
  return PLACEMENT_MONTH_TIERS.filter((t) => placementCount >= t);
}

/**
 * True when every client was contacted at least once in the month by this specialist.
 * Requires {@link STAFF_BADGE_MIN_CLIENTS}.
 */
export function everyClientContactedInMonth(input: {
  caseloadClientIds: string[];
  contactedClientIds: Set<string>;
}): boolean {
  if (input.caseloadClientIds.length < STAFF_BADGE_MIN_CLIENTS) return false;
  return input.caseloadClientIds.every((id) => input.contactedClientIds.has(id));
}

/**
 * No client went {@link NO_CONTACT_DAYS}+ days without a contact during [windowStart, windowEnd].
 * Aligns with caseload-triage's 14-day no-contact rule. Requires min clients.
 *
 * `contactYmdsByClient` are America/New_York calendar dates of contacts by this specialist
 * (may include dates before windowStart for coverage at month open).
 */
export function noFourteenDayGapsInMonth(input: {
  caseloadClientIds: string[];
  contactYmdsByClient: Map<string, string[]>;
  windowStart: string;
  windowEnd: string;
}): boolean {
  if (input.caseloadClientIds.length < STAFF_BADGE_MIN_CLIENTS) return false;
  for (const clientId of input.caseloadClientIds) {
    if (
      !clientHasNoFourteenDayGap({
        contactYmds: input.contactYmdsByClient.get(clientId) ?? [],
        windowStart: input.windowStart,
        windowEnd: input.windowEnd,
      })
    ) {
      return false;
    }
  }
  return true;
}

export function clientHasNoFourteenDayGap(input: {
  contactYmds: string[];
  windowStart: string;
  windowEnd: string;
}): boolean {
  const contacts = [
    ...new Set(
      input.contactYmds
        .map((d) => d.trim().slice(0, 10))
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    ),
  ].sort();

  let day = input.windowStart;
  while (day <= input.windowEnd) {
    const earliest = addCalendarDays(day, -(NO_CONTACT_DAYS - 1));
    const covered = contacts.some((c) => c >= earliest && c <= day);
    if (!covered) return false;
    day = addCalendarDays(day, 1);
  }
  return true;
}

/**
 * Consecutive-month streak helpers. `earnedMonthKeys` are months that earned the badge,
 * sorted or unsorted. `throughMonth` is the newest month that may count (usually current
 * or prior closed month).
 */
export function computeMonthStreaks(
  earnedMonthKeys: string[],
  throughMonth: string
): { current: number; best: number } {
  const set = new Set(earnedMonthKeys.filter((k) => k <= throughMonth));
  if (set.size === 0) return { current: 0, best: 0 };

  const all = [...set].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < all.length; i++) {
    if (previousMonthKey(all[i]!) === all[i - 1]) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 1;
    }
  }

  let current = 0;
  let cursor: string | null = throughMonth;
  while (cursor && set.has(cursor)) {
    current += 1;
    cursor = previousMonthKey(cursor);
    // Safety: don't walk forever
    if (current > 600) break;
  }
  best = Math.max(best, current);
  return { current, best };
}

export function isNewPersonalBest(
  monthPlacementCount: number,
  previousMonthCounts: number[]
): boolean {
  if (monthPlacementCount <= 0) return false;
  if (previousMonthCounts.length === 0) return true;
  return monthPlacementCount > Math.max(...previousMonthCounts);
}

export function badgeLabel(badgeKey: string): string {
  switch (badgeKey) {
    case "placements_1":
      return "First placement of the month";
    case "placements_2":
      return "Two placements";
    case "placements_3":
      return "Three placements";
    case "kra_50":
      return "KRA half way";
    case "kra_75":
      return "KRA strong";
    case "kra_100":
      return "KRA complete";
    case "every_client_contacted":
      return "Every client contacted";
    case "no_14_day_gaps":
      return "Steady contact";
    case "first_placement":
      return "First career placement";
    case "career_placements_25":
      return "25 career placements";
    case "career_placements_50":
      return "50 career placements";
    case "career_placements_100":
      return "100 career placements";
    case "personal_best":
      return "Personal best month";
    default:
      return badgeKey;
  }
}

export function badgeDescription(badgeKey: string): string {
  switch (badgeKey) {
    case "placements_1":
      return "One client started a job this month on your caseload.";
    case "placements_2":
      return "Two clients started jobs this month on your caseload.";
    case "placements_3":
      return "Three clients started jobs this month on your caseload.";
    case "kra_50":
      return "At least half of your in-scope clients met monthly KRA hours.";
    case "kra_75":
      return "At least three-quarters of your in-scope clients met monthly KRA hours.";
    case "kra_100":
      return "Every in-scope client met monthly KRA hours.";
    case "every_client_contacted":
      return "You logged contact with every client on your caseload this month.";
    case "no_14_day_gaps":
      return "No caseload client went 14 or more days without contact this month.";
    case "first_placement":
      return "Your first job placement.";
    case "career_placements_25":
      return "25 job placements across your career.";
    case "career_placements_50":
      return "50 job placements across your career.";
    case "career_placements_100":
      return "100 job placements across your career.";
    case "personal_best":
      return "More placements in a month than any prior month.";
    default:
      return "";
  }
}
