"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  staffUserId: string;
  staffName: string;
  billableMinutes: number;
  billableHours: string;
};

type Payload = {
  monthKey: string;
  monthLabel: string;
  range: { start: string; end: string };
  rows: Row[];
};

function monthInputValue(monthKey: string): string {
  return `${monthKey}-01`;
}

function monthKeyFromInput(value: string): string {
  return value.slice(0, 7);
}

export function BillableHoursPayrollMonthlyPanel({
  initialMonthKey,
}: {
  initialMonthKey: string;
}) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [payload, setPayload] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/billable-hours/monthly-summary?month=${encodeURIComponent(key)}`);
    const data = (await res.json()) as Payload & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load monthly totals");
      setPayload(null);
    } else {
      setPayload(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(monthKey);
  }, [monthKey, load]);

  const totalHours = useMemo(() => {
    if (!payload?.rows.length) return "0.0";
    const minutes = payload.rows.reduce((s, r) => s + r.billableMinutes, 0);
    return (minutes / 60).toFixed(1);
  }, [payload]);

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-green">Monthly billable hours (payroll)</h2>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
            Logged service time by team member for a full calendar month (America/New_York). On the
            1st, this defaults to the previous month for payroll review.
          </p>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/70">Month</span>
          <input
            type="month"
            className="rounded-md border border-neutral-300 px-3 py-2 text-brand-black"
            value={monthInputValue(monthKey)}
            onChange={(e) => setMonthKey(monthKeyFromInput(e.target.value))}
          />
        </label>
      </div>
      {payload ? (
        <p className="mt-3 text-xs text-brand-black/55">
          {payload.monthLabel}: {payload.range.start} – {payload.range.end} · Org total{" "}
          <span className="font-medium text-brand-green">{totalHours}</span> hours
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-700">{error}</p>
      ) : loading ? (
        <p className="mt-4 text-sm text-brand-black/60">Loading…</p>
      ) : !payload?.rows.length ? (
        <p className="mt-4 text-sm text-brand-black/60">No team members or hours for this month.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-brand-black/60">
                <th className="py-2 pr-4 font-medium">Team member</th>
                <th className="py-2 font-medium">Billable hours</th>
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((r) => (
                <tr key={r.staffUserId} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 text-brand-black">{r.staffName}</td>
                  <td className="py-2 font-medium text-brand-green">{r.billableHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
