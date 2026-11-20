"use client";

import { formatBillableHours } from "@wayfinder/supabase/client-billable";
import { useCallback, useEffect, useMemo, useState } from "react";

type Row = {
  staffUserId: string;
  staffName: string;
  billableMinutes: number;
  billableHours: string;
  rosterStatus?: "active" | "former" | "needs_review";
  expectedBillableMinutes?: number;
  expectedBillableHours?: string;
  priorMonthMinutes?: number;
  priorMonthHours?: string;
  deltaVsPriorMinutes?: number;
  deltaVsPriorHours?: string;
  deltaVsExpectedMinutes?: number;
  deltaVsExpectedHours?: string;
};

type WeekBucket = {
  weekStart: string;
  weekEnd: string;
  label: string;
  billableMinutes: number;
  billableHours: string;
};

type Payload = {
  monthKey: string;
  monthLabel: string;
  range: { start: string; end: string };
  rows: Row[];
  orgTotalMinutes?: number;
  orgTotalHours?: string;
  priorMonthKey?: string;
  priorMonthLabel?: string;
  priorMonthMinutes?: number;
  priorMonthHours?: string;
  deltaVsPriorMinutes?: number;
  deltaVsPriorHours?: string;
  weeks?: WeekBucket[];
};

function monthInputValue(monthKey: string): string {
  return `${monthKey}-01`;
}

function monthKeyFromInput(value: string): string {
  return value.slice(0, 7);
}

export function BillableHoursPayrollMonthlyPanel({
  initialMonthKey,
  monthKey: controlledMonthKey,
  onMonthKeyChange,
  embedded = false,
}: {
  initialMonthKey: string;
  monthKey?: string;
  onMonthKeyChange?: (key: string) => void;
  embedded?: boolean;
}) {
  const [internalMonthKey, setInternalMonthKey] = useState(initialMonthKey);
  const monthKey = controlledMonthKey ?? internalMonthKey;
  const setMonthKey = onMonthKeyChange ?? setInternalMonthKey;
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
    if (payload?.orgTotalHours) return payload.orgTotalHours;
    if (!payload?.rows.length) return "0.0";
    const minutes = payload.rows.reduce((s, r) => s + r.billableMinutes, 0);
    return formatBillableHours(minutes);
  }, [payload]);

  const body = (
    <>
      {!embedded ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-green">
              Monthly billable hours (payroll)
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
              Billable service time by team member for a full calendar month (America/New_York),
              including former team members who logged hours that month. Excludes Case File Review
              and note-only contact only — client present does not affect totals.
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
      ) : (
        <p className="mt-4 text-sm text-brand-black/70">
          Actual hours logged for payroll include all billable services (IJP/TSE, WRT, Job Coaching,
          and others). Expected hours come only from KRA-scope IJP/TSE clients × the monthly
          threshold. Week totals and vs-last-month use hours, not percentages.
        </p>
      )}

      {payload ? (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-brand-black/55">
            {payload.monthLabel}: {payload.range.start} – {payload.range.end} · Org total{" "}
            <span className="font-medium text-brand-green">{totalHours}</span> hrs
            {payload.priorMonthLabel ? (
              <>
                {" "}
                · vs {payload.priorMonthLabel}:{" "}
                <span className="font-medium tabular-nums">{payload.priorMonthHours ?? "0.0"}</span>{" "}
                hrs (
                <span className="font-medium tabular-nums">{payload.deltaVsPriorHours ?? "0.0"}</span>{" "}
                hrs)
              </>
            ) : null}
          </p>
          {payload.weeks && payload.weeks.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {payload.weeks.map((w) => (
                <div
                  key={w.weekStart}
                  className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-brand-black/55">
                    Week
                  </p>
                  <p className="text-xs text-brand-black/60">{w.label}</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-brand-black">
                    {w.billableHours} hrs
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
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
                <th className="py-2 pr-3 font-medium">Actual</th>
                <th className="py-2 pr-3 font-medium">Expected</th>
                <th className="py-2 pr-3 font-medium">vs expected</th>
                <th className="py-2 pr-3 font-medium">Last month</th>
                <th className="py-2 font-medium">vs last month</th>
              </tr>
            </thead>
            <tbody>
              {payload.rows.map((r) => (
                <tr
                  key={r.staffUserId}
                  className={
                    r.rosterStatus === "needs_review"
                      ? "border-b border-amber-100 bg-amber-50/40"
                      : r.rosterStatus === "former"
                        ? "border-b border-neutral-100 bg-neutral-50/60"
                        : "border-b border-neutral-100"
                  }
                >
                  <td className="py-2 pr-4 text-brand-black">{r.staffName}</td>
                  <td className="py-2 pr-3 font-medium tabular-nums text-brand-green">
                    {r.billableHours} hrs
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-brand-black">
                    {r.expectedBillableHours ?? "0.0"} hrs
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-brand-black/80">
                    {r.deltaVsExpectedHours ?? "0.0"} hrs
                  </td>
                  <td className="py-2 pr-3 tabular-nums text-brand-black/80">
                    {r.priorMonthHours ?? "0.0"} hrs
                  </td>
                  <td className="py-2 tabular-nums text-brand-black/80">
                    {r.deltaVsPriorHours ?? "0.0"} hrs
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="rounded-b-xl border border-t-0 border-neutral-200 bg-white p-5">{body}</div>;
  }

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">{body}</section>
  );
}
