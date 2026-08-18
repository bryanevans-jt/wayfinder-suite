export type SchedulePlanInput = {
  planType: "recurring" | "monthly" | "custom" | "intensive";
  recurrenceRule?: Record<string, unknown>;
  excludedMonths?: string[];
  startDate?: string | null;
  endDate?: string | null;
  sessionDates?: string[];
};

function parseIsoDate(value: string): Date | null {
  const d = new Date(`${value}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Expand a schedule plan into session dates (YYYY-MM-DD). */
export function expandPreEtsScheduleDates(input: SchedulePlanInput): string[] {
  if (input.sessionDates?.length) {
    return [...new Set(input.sessionDates.map((d) => d.trim()).filter(Boolean))].sort();
  }

  const start = input.startDate ? parseIsoDate(input.startDate) : null;
  const end = input.endDate ? parseIsoDate(input.endDate) : null;
  if (!start || !end || end < start) return [];

  const excluded = new Set((input.excludedMonths ?? []).map((m) => m.slice(0, 7)));
  const dates: string[] = [];

  if (input.planType === "monthly") {
    const dayOfMonth = Number(input.recurrenceRule?.dayOfMonth ?? 15);
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)).getUTCDate();
      const day = Math.min(Math.max(1, dayOfMonth), lastDay);
      const session = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), day));
      if (session >= start && session <= end && !excluded.has(monthKey(session))) {
        dates.push(isoDate(session));
      }
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return dates;
  }

  if (input.planType === "recurring") {
    const weekday = Number(input.recurrenceRule?.weekday ?? 2);
    const intervalWeeks = Math.max(1, Number(input.recurrenceRule?.intervalWeeks ?? 1));
    const cursor = new Date(start);
    while (cursor.getUTCDay() !== weekday) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      if (cursor > end) return dates;
    }
    while (cursor <= end) {
      if (!excluded.has(monthKey(cursor))) {
        dates.push(isoDate(cursor));
      }
      cursor.setUTCDate(cursor.getUTCDate() + intervalWeeks * 7);
    }
    return dates;
  }

  return [];
}
