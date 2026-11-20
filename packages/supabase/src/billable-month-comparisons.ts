import { formatBillableHours } from "./client-billable";
import { weekEndSaturday, weekStartSunday } from "./es-time-tracking";

export type BillableMonthWeekBucket = {
  weekStart: string;
  weekEnd: string;
  label: string;
  billableMinutes: number;
  billableHours: string;
};

/** Prior calendar month key (YYYY-MM) from a YYYY-MM key. */
export function priorMonthKeyFrom(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate()
  ).padStart(2, "0")}`;
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const fmt = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, d, 12)));
  };
  return `${fmt(weekStart)} – ${fmt(weekEnd)}`;
}

/**
 * Build Sunday–Saturday week buckets that overlap [rangeStart, rangeEnd].
 * Minutes are attributed by service_date; weeks may extend slightly outside the month.
 */
export function buildBillableMonthWeekBuckets(opts: {
  rangeStart: string;
  rangeEnd: string;
  entries: Array<{ service_date: string; billableMinutes: number }>;
}): BillableMonthWeekBucket[] {
  const firstWeekStart = weekStartSunday(opts.rangeStart);
  const buckets: BillableMonthWeekBucket[] = [];
  let cursor = firstWeekStart;
  while (cursor <= opts.rangeEnd) {
    const weekEnd = weekEndSaturday(cursor);
    buckets.push({
      weekStart: cursor,
      weekEnd,
      label: formatWeekLabel(cursor, weekEnd),
      billableMinutes: 0,
      billableHours: "0.0",
    });
    cursor = addDaysYmd(weekEnd, 1);
  }

  for (const entry of opts.entries) {
    if (entry.service_date < opts.rangeStart || entry.service_date > opts.rangeEnd) continue;
    const mins = entry.billableMinutes || 0;
    if (mins <= 0) continue;
    const bucket = buckets.find(
      (b) => entry.service_date >= b.weekStart && entry.service_date <= b.weekEnd
    );
    if (bucket) bucket.billableMinutes += mins;
  }

  for (const b of buckets) {
    b.billableHours = formatBillableHours(b.billableMinutes);
  }
  return buckets;
}

export function hoursDeltaLabel(currentMinutes: number, priorMinutes: number): {
  deltaMinutes: number;
  deltaHours: string;
} {
  const deltaMinutes = currentMinutes - priorMinutes;
  const sign = deltaMinutes > 0 ? "+" : "";
  return {
    deltaMinutes,
    deltaHours: `${sign}${formatBillableHours(deltaMinutes)}`,
  };
}
