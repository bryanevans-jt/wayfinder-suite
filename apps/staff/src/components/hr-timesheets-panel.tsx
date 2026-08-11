"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type SignedInRow = {
  staffUserId: string;
  name: string;
  clockInAt: string;
  minutesSoFar: number;
};

type HoursRow = {
  staffUserId: string;
  name: string;
  minutes: number;
  hoursLabel: string;
  signedIn: boolean;
};

type WeekOption = { weekStart: string; weekEnd: string };

type Payload = {
  weekStart: string;
  weekEnd: string;
  weekOptions: WeekOption[];
  signedIn: SignedInRow[];
  hours: HoursRow[];
};

type PageSize = 10 | 25 | "all";

function formatClockIn(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatWeekLabel(weekStart: string, weekEnd: string): string {
  const start = new Date(`${weekStart}T12:00:00`);
  const end = new Date(`${weekEnd}T12:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  })}`;
}

function minutesLabel(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}m`;
  return `${h}h ${rem}m`;
}

export function HrTimesheetsPanel() {
  const [week, setWeek] = useState<string>("");
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState<PageSize>(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async (weekStart?: string) => {
    setError(null);
    try {
      const qs = weekStart ? `?week=${encodeURIComponent(weekStart)}` : "";
      const res = await fetch(`/api/hr/time-clock${qs}`);
      const json = (await res.json()) as Payload & { error?: string };
      if (!res.ok) throw new Error(json.error || "Failed to load time clock");
      setData(json);
      if (!weekStart) setWeek(json.weekStart);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load time clock");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(week || undefined);
    const timer = window.setInterval(() => {
      void load(week || undefined);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [load, week]);

  const signedIn = useMemo(() => data?.signedIn ?? [], [data?.signedIn]);
  const totalPages = pageSize === "all" || signedIn.length === 0 ? 1 : Math.ceil(signedIn.length / pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pagedSignedIn = useMemo(() => {
    if (pageSize === "all") return signedIn;
    const start = (safePage - 1) * pageSize;
    return signedIn.slice(start, start + pageSize);
  }, [signedIn, pageSize, safePage]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-black">Signed In Now</h2>
            <p className="mt-1 text-sm text-brand-black/70">
              Company-wide Time Clock (payroll). Updates about every 30 seconds.
            </p>
          </div>
          <label className="text-sm font-medium">
            Per page
            <select
              value={pageSize}
              onChange={(e) => {
                const next = e.target.value === "all" ? "all" : Number(e.target.value);
                setPageSize(next === 25 ? 25 : next === "all" ? "all" : 10);
                setPage(1);
              }}
              className="ml-2 rounded-lg border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </p>
        ) : null}
        {loading && !data ? (
          <p className="mt-4 text-sm text-brand-black/60">Loading…</p>
        ) : signedIn.length === 0 ? (
          <p className="mt-4 text-sm text-brand-black/60">Nobody is signed in right now.</p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-neutral-50 text-brand-black/70">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Clocked in</th>
                    <th className="px-3 py-2">Minutes so far</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedSignedIn.map((row) => (
                    <tr key={row.staffUserId} className="border-t border-neutral-100">
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3">{formatClockIn(row.clockInAt)} ET</td>
                      <td className="px-3 py-3">{minutesLabel(row.minutesSoFar)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-brand-black/70">
                  Page {safePage} of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-brand-black">Hours Worked</h2>
            <p className="mt-1 text-sm text-brand-black/70">
              Sunday–Saturday, America/New_York. Open shifts count through now.
            </p>
          </div>
          <label className="text-sm font-medium">
            Week
            <select
              value={week || data?.weekStart || ""}
              onChange={(e) => {
                setWeek(e.target.value);
                setLoading(true);
              }}
              className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            >
              {(data?.weekOptions ?? []).map((opt) => (
                <option key={opt.weekStart} value={opt.weekStart}>
                  {formatWeekLabel(opt.weekStart, opt.weekEnd)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!data ? (
          <p className="mt-4 text-sm text-brand-black/60">Loading…</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-neutral-50 text-brand-black/70">
                <tr>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Hours to date</th>
                  <th className="px-3 py-2">Signed in</th>
                </tr>
              </thead>
              <tbody>
                {data.hours.map((row) => (
                  <tr key={row.staffUserId} className="border-t border-neutral-100">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3">{row.hoursLabel}</td>
                    <td className="px-3 py-3">{row.signedIn ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="text-base font-semibold text-brand-black">Weekly Timesheet</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Employment Specialist billable time (Accounts Specialist workflow). Separate from Time
          Clock payroll hours above.
        </p>
        <Link
          href="/dashboard/timesheet"
          className="mt-4 inline-flex rounded-lg border border-brand-gold bg-brand-gold px-4 py-2 text-sm font-semibold text-white"
        >
          Open Weekly Timesheet
        </Link>
      </div>
    </section>
  );
}
