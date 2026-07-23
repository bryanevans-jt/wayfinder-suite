import {
  isCounselorRole,
  isStaffRole,
} from "./roles";

export const STAFF_CLOCK_TIMEZONE = "America/New_York";
export const STAFF_CLOCK_MIN_MINUTES = 1;

export type StaffClockAutoOutReason = "still_working_timeout" | "midnight_split";

export type StaffClockShiftRow = {
  id: string;
  staff_user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  local_date: string;
  auto_out_reason: StaffClockAutoOutReason | null;
  needs_attention: boolean;
  attention_cleared_at: string | null;
  still_working_prompted_at: string | null;
  still_working_ack_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffClockEditLogRow = {
  id: string;
  shift_id: string;
  edited_by: string;
  edited_at: string;
  action: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  reason: string | null;
};

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Joshua Tree salaried team (not counselors, clients, or natural supports). */
export function canUseStaffClock(role: string | null | undefined): boolean {
  return isStaffRole(role) && !isCounselorRole(role);
}

export function zonedDateTimeParts(
  date: Date,
  timeZone: string = STAFF_CLOCK_TIMEZONE
): ZonedParts {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

export function localDateStringInTz(
  date: Date = new Date(),
  timeZone: string = STAFF_CLOCK_TIMEZONE
): string {
  const p = zonedDateTimeParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Convert America/New_York wall time to a UTC Date. */
export function nyLocalToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0
): Date {
  let d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  for (let i = 0; i < 3; i++) {
    const p = zonedDateTimeParts(d);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
    d = new Date(d.getTime() + (wanted - asUtc));
  }
  return d;
}

export function parseLocalDate(localDate: string): { year: number; month: number; day: number } {
  const [y, m, d] = localDate.split("-").map(Number);
  return { year: y, month: m, day: d };
}

export function shiftDurationMinutes(
  clockInAt: string,
  clockOutAt: string | null,
  now: Date = new Date()
): number {
  const start = new Date(clockInAt).getTime();
  const end = clockOutAt ? new Date(clockOutAt).getTime() : now.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return 0;
  }
  return Math.max(0, Math.floor((end - start) / 60_000));
}

export function sumShiftMinutes(
  shifts: Array<{ clock_in_at: string; clock_out_at: string | null }>,
  now: Date = new Date()
): number {
  return shifts.reduce(
    (sum, s) => sum + shiftDurationMinutes(s.clock_in_at, s.clock_out_at, now),
    0
  );
}

export function minutesToClockLabel(totalMinutes: number): string {
  const m = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}
