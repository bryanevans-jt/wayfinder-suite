"use client";

import { minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type WeekHours = {
  weekStart: string;
  weekEnd: string;
  billableMinutes: number;
  workedMinutes: number;
  workedFromClock: boolean;
};

type Row = {
  esUserId: string;
  esName: string;
  currentWeek: WeekHours;
  previousWeek: WeekHours;
};

function formatWeekRange(start: string, end: string): string {
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
  return `${fmt.format(new Date(start + "T12:00:00"))} – ${fmt.format(new Date(end + "T12:00:00"))}`;
}

function hoursLabel(minutes: number): string {
  return `${minutesToDecimalHours(minutes)} hrs`;
}

export function SupervisorTeamHoursPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/supervisor/team-hours", { cache: "no-store" });
      const data = (await res.json()) as { rows?: Row[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not load team hours.");
      setRows(data.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load team hours.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const weekLabel =
    rows[0]?.currentWeek != null
      ? formatWeekRange(rows[0].currentWeek.weekStart, rows[0].currentWeek.weekEnd)
      : null;
  const prevWeekLabel =
    rows[0]?.previousWeek != null
      ? formatWeekRange(rows[0].previousWeek.weekStart, rows[0].previousWeek.weekEnd)
      : null;

  return (
    <section className="rounded-xl border border-neutral-200 bg-white px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-brand-black">Team hours</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Billable hours from logged service time and hours worked from the Time Clock (when used).
            Pay weeks run Sunday through Saturday. No timesheet submission required — this reflects
            data as entered.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-xs font-semibold text-brand-green hover:underline"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-800">{error}</p>
      ) : loading ? (
        <p className="mt-3 text-sm text-brand-black/60">Loading team hours…</p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-brand-black/60">
          No Employment Specialists are assigned to you yet.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-brand-black/70">
              <tr>
                <th className="px-3 py-2">Team member</th>
                <th className="px-3 py-2">
                  This week
                  {weekLabel ? (
                    <span className="mt-0.5 block text-xs font-normal text-brand-black/55">
                      {weekLabel}
                    </span>
                  ) : null}
                </th>
                <th className="px-3 py-2">
                  Last week
                  {prevWeekLabel ? (
                    <span className="mt-0.5 block text-xs font-normal text-brand-black/55">
                      {prevWeekLabel}
                    </span>
                  ) : null}
                </th>
                <th className="px-3 py-2">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.esUserId} className="border-t border-neutral-100">
                  <td className="px-3 py-3 font-medium text-brand-black">{row.esName}</td>
                  <td className="px-3 py-3 text-brand-black/80">
                    <p>
                      Billable:{" "}
                      <span className="font-semibold tabular-nums text-brand-black">
                        {hoursLabel(row.currentWeek.billableMinutes)}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      Worked:{" "}
                      <span className="font-semibold tabular-nums text-brand-black">
                        {hoursLabel(row.currentWeek.workedMinutes)}
                      </span>
                      {row.currentWeek.workedFromClock ? (
                        <span className="text-xs text-brand-black/50"> (Time Clock)</span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-brand-black/80">
                    <p>
                      Billable:{" "}
                      <span className="font-semibold tabular-nums text-brand-black">
                        {hoursLabel(row.previousWeek.billableMinutes)}
                      </span>
                    </p>
                    <p className="mt-0.5">
                      Worked:{" "}
                      <span className="font-semibold tabular-nums text-brand-black">
                        {hoursLabel(row.previousWeek.workedMinutes)}
                      </span>
                      {row.previousWeek.workedFromClock ? (
                        <span className="text-xs text-brand-black/50"> (Time Clock)</span>
                      ) : null}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/dashboard/timesheet?es=${encodeURIComponent(row.esUserId)}&week=${encodeURIComponent(row.currentWeek.weekStart)}`}
                      className="font-medium text-brand-green hover:underline"
                    >
                      Open timesheet
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
