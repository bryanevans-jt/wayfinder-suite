"use client";

import type { KraStaffComplianceRow } from "@wayfinder/supabase/kra-billable-compliance";
import { DEFAULT_KRA_HOURS_PER_CLIENT } from "@wayfinder/supabase/kra-billable-settings";
import { useCallback, useEffect, useState } from "react";

type MinePayload = {
  monthKey: string;
  monthLabel: string;
  expectedHoursPerClient: number;
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
  const expected =
    payload?.expectedHoursPerClient ?? DEFAULT_KRA_HOURS_PER_CLIENT;

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
              Expected {expected} billable hours per client
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
