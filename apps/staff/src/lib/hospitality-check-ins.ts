import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";

export const CHECK_IN_OUTCOMES = ["reached", "voicemail", "no_answer", "other"] as const;
export type CheckInOutcome = (typeof CHECK_IN_OUTCOMES)[number];

export function isCheckInOutcome(value: string | null | undefined): value is CheckInOutcome {
  return (CHECK_IN_OUTCOMES as readonly string[]).includes((value ?? "").trim());
}

/** Sunday of the current Sun–Sat week in America/New_York (YYYY-MM-DD). */
export function contactWeekStart(date = new Date()): string {
  return weekStartSunday(localDateStringInTz(date, STAFF_CLOCK_TIMEZONE));
}

export function contactWeekEnd(weekStart: string): string {
  return weekEndSaturday(weekStart);
}

export function weekLabel(weekStart: string): string {
  const end = contactWeekEnd(weekStart);
  const fmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(new Date(weekStart + "T12:00:00Z"))} – ${fmt.format(new Date(end + "T12:00:00Z"))}`;
}

/** First day of the current calendar month in America/New_York. */
export function contactMonthStart(date = new Date()): string {
  return `${localDateStringInTz(date, STAFF_CLOCK_TIMEZONE).slice(0, 7)}-01`;
}

export function monthLabel(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function checkInOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case "reached":
      return "Reached";
    case "voicemail":
      return "Voicemail";
    case "no_answer":
      return "No answer";
    default:
      return "Other";
  }
}
