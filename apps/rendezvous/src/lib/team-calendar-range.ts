/**
 * Team Calendar date-window math in Eastern Time (America/New_York).
 * Browser/server local zone must not decide day/week/month boundaries.
 */

import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import {
  dateKeyInTimeZone,
  weekdayInTimeZone,
  zonedDateTimeToUtc,
} from "./scheduling/slots";

export type TeamCalendarViewMode = "day" | "week" | "month";

function parseCivilKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function addCivilDays(
  year: number,
  month: number,
  day: number,
  delta: number
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(year, month - 1, day + delta));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
  };
}

function etMidnightUtc(year: number, month: number, day: number): Date {
  return zonedDateTimeToUtc(year, month, day, 0, 0, PORTAL_DISPLAY_TIME_ZONE);
}

/** Civil y/m/d for `instant` as observed in Eastern Time. */
export function easternCivilParts(instant: Date): {
  year: number;
  month: number;
  day: number;
} {
  return parseCivilKey(dateKeyInTimeZone(instant, PORTAL_DISPLAY_TIME_ZONE));
}

/**
 * Visible fetch window for day/week/month, bounded in Eastern Time and
 * returned as UTC instants for Google/Rendezvous queries.
 */
export function rangeForViewInEastern(
  anchor: Date,
  view: TeamCalendarViewMode
): { from: Date; to: Date } {
  const { year, month, day } = easternCivilParts(anchor);

  if (view === "day") {
    const from = etMidnightUtc(year, month, day);
    const next = addCivilDays(year, month, day, 1);
    return { from, to: etMidnightUtc(next.year, next.month, next.day) };
  }

  if (view === "week") {
    // Sunday-start week in Eastern (matches FullCalendar default).
    const noon = zonedDateTimeToUtc(year, month, day, 12, 0, PORTAL_DISPLAY_TIME_ZONE);
    const dow = weekdayInTimeZone(noon, PORTAL_DISPLAY_TIME_ZONE);
    const sunday = addCivilDays(year, month, day, -dow);
    const nextSunday = addCivilDays(sunday.year, sunday.month, sunday.day, 7);
    return {
      from: etMidnightUtc(sunday.year, sunday.month, sunday.day),
      to: etMidnightUtc(nextSunday.year, nextSunday.month, nextSunday.day),
    };
  }

  // Month grid: padded Sunday→Saturday around the Eastern calendar month.
  const first = { year, month, day: 1 };
  const firstNoon = zonedDateTimeToUtc(year, month, 1, 12, 0, PORTAL_DISPLAY_TIME_ZONE);
  const firstDow = weekdayInTimeZone(firstNoon, PORTAL_DISPLAY_TIME_ZONE);
  const padStart = addCivilDays(first.year, first.month, first.day, -firstDow);

  const nextMonth =
    month === 12 ? { year: year + 1, month: 1, day: 1 } : { year, month: month + 1, day: 1 };
  const nextMonthNoon = zonedDateTimeToUtc(
    nextMonth.year,
    nextMonth.month,
    1,
    12,
    0,
    PORTAL_DISPLAY_TIME_ZONE
  );
  const nextMonthDow = weekdayInTimeZone(nextMonthNoon, PORTAL_DISPLAY_TIME_ZONE);
  const lastVisible = addCivilDays(
    nextMonth.year,
    nextMonth.month,
    nextMonth.day,
    6 - nextMonthDow
  );
  const afterLast = addCivilDays(lastVisible.year, lastVisible.month, lastVisible.day, 1);

  return {
    from: etMidnightUtc(padStart.year, padStart.month, padStart.day),
    to: etMidnightUtc(afterLast.year, afterLast.month, afterLast.day),
  };
}

/** Shift an anchor by N Eastern civil days (for Previous/Next day). */
export function shiftEasternDays(anchor: Date, deltaDays: number): Date {
  const { year, month, day } = easternCivilParts(anchor);
  const next = addCivilDays(year, month, day, deltaDays);
  return zonedDateTimeToUtc(next.year, next.month, next.day, 12, 0, PORTAL_DISPLAY_TIME_ZONE);
}

/** Shift an anchor by N Eastern calendar months (for Previous/Next month). */
export function shiftEasternMonths(anchor: Date, deltaMonths: number): Date {
  const { year, month, day } = easternCivilParts(anchor);
  const idx = year * 12 + (month - 1) + deltaMonths;
  const y = Math.floor(idx / 12);
  const m = (idx % 12) + 1;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const d = Math.min(day, lastDay);
  return zonedDateTimeToUtc(y, m, d, 12, 0, PORTAL_DISPLAY_TIME_ZONE);
}
