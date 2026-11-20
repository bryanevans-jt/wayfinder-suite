"use client";

import type { KraStaffComplianceRow } from "@wayfinder/supabase/kra-billable-compliance";
import { formatBillableHours } from "@wayfinder/supabase/client-billable";
import { DEFAULT_KRA_HOURS_PER_CLIENT } from "@wayfinder/supabase/kra-billable-settings";
import { useCallback, useEffect, useState } from "react";

type MinePayload = {
  monthKey: string;
  monthLabel: string;
  expectedHoursPerClient: number;
  expectedBillableMinutes?: number;
  expectedBillableHours?: string;
  billedMinutes?: number;
  row: KraStaffComplianceRow;
  error?: string;
};

type Props = {
  initialMonthKey: string;
};

export function MyKraBillableExpectationCard({ initialMonthKey }: Props) {
  const [monthKey] = useState(initialMonthKey);
  const [payload, setPayload] = useState<MinePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/kra-billable-compliance/mine?month=${encodeURIComponent(key)}`
    );
    const data = (await res.json()) as MinePayload;
    if (!res.ok) {
      setError(data.error ?? "Could not load billable expectations");
      setPayload(null);
    } else {
      setPayload(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(monthKey);
  }, [monthKey, load]);

  const met = payload?.row.metCount ?? 0;
  const total = payload?.row.inScopeClientCount ?? 0;
  const pct = total > 0 ? Math.round((met / total) * 100) : null;
  const expectedPerClient =
    payload?.expectedHoursPerClient ?? DEFAULT_KRA_HOURS_PER_CLIENT;
  const expectedHours =
    payload?.expectedBillableHours ??
    payload?.row.expectedBillableHours ??
    "0.0";
  const billedHours = formatBillableHours(payload?.billedMinutes ?? 0);

  return (
    <section className="mt-6 rounded-xl border border-brand-green/25 bg-gradient-to-br from-brand-green/5 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-brand-green">
            Client billable expectations
          </h2>
          <p className="mt-1 text-sm text-brand-black/70">
            Your clients meeting the monthly billable-hour expectation
            {payload?.monthLabel ? ` for ${payload.monthLabel}` : ""}.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-brand-black/55">Loading…</p>
        ) : error ? (
          <p className="text-sm text-red-700">{error}</p>
        ) : (
          <div className="text-right">
            <p className="text-3xl font-bold tabular-nums text-brand-black">
              {met} / {total}
              {pct !== null ? (
                <span className="ml-2 text-lg font-semibold text-brand-black/55">
                  ({pct}%)
                </span>
              ) : null}
            </p>
            <p className="mt-1 text-xs text-brand-black/60">
              Expected {expectedPerClient} billable hours per client
            </p>
          </div>
        )}
      </div>
      {!loading && !error ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-100 bg-white/80 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">
              Hours billed so far
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-black">
              {billedHours} hrs
            </p>
          </div>
          <div className="rounded-lg border border-neutral-100 bg-white/80 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">
              Expected this month
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-brand-black">
              {expectedHours} hrs
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
