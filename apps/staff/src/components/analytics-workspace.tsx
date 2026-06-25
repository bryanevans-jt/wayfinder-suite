"use client";

import { ANALYTICS_METRIC_DEFINITIONS, defaultAnalyticsRange } from "@/lib/analytics/definitions";
import type { AnalyticsSummary } from "@/lib/analytics/load-metrics";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useMemo, useState } from "react";

type FilterOptions = {
  offices: { id: string; name: string }[];
  esUsers: { id: string; name: string }[];
  canFilterByEs: boolean;
  canFilterByOffice: boolean;
};

type Props = {
  readOnly?: boolean;
  showBenchmark?: boolean;
};

function formatPercent(value: number | null): string {
  if (value == null) {
    return "—";
  }
  return `${value.toFixed(1)}%`;
}

function formatMonthLabel(yyyyMm: string): string {
  const [y, m] = yyyyMm.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function AnalyticsWorkspace({ readOnly = false, showBenchmark = false }: Props) {
  const defaults = useMemo(() => defaultAnalyticsRange(), []);
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [officeId, setOfficeId] = useState("");
  const [esUserId, setEsUserId] = useState("");
  const [filters, setFilters] = useState<FilterOptions | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [benchmark, setBenchmark] = useState<{
    hireRateDeltaPct: number | null;
    medianDaysToHireDelta: number | null;
    current: { hireRate: number | null; medianDaysToHire: number | null };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ from, to });
    if (officeId) {
      params.set("officeId", officeId);
    }
    if (esUserId) {
      params.set("esUserId", esUserId);
    }
    return params.toString();
  }, [from, to, officeId, esUserId]);

  const loadFilters = useCallback(async () => {
    const res = await fetch("/api/analytics/filters");
    const data = (await res.json()) as FilterOptions & { error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setFilters(data);
  }, []);

  const loadSummary = useCallback(async () => {
    setError(null);
    const res = await fetch(`/api/analytics/summary?${queryString}`);
    const data = (await res.json()) as { summary?: AnalyticsSummary; error?: string };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    setSummary(data.summary ?? null);
  }, [queryString]);

  useEffect(() => {
    void (async () => {
      try {
        await loadFilters();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    })();
  }, [loadFilters]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        await loadSummary();
        if (showBenchmark) {
          const bRes = await fetch(`/api/analytics/benchmark?${queryString}`);
          const bData = (await bRes.json()) as { benchmark?: typeof benchmark };
          if (bRes.ok) setBenchmark(bData.benchmark ?? null);
        }
      } catch (e) {
        setError(friendlyClientError(e));
        setSummary(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSummary, showBenchmark, queryString]);

  const exportHref = `/api/analytics/export?${queryString}`;

  return (
    <div className="mt-8 max-w-5xl space-y-8">
      {readOnly ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — analytics reflect this user&apos;s scope.
        </p>
      ) : null}

      <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-brand-black">Filters</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="font-medium text-brand-black/80">From</span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-brand-black/80">To</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          {filters?.canFilterByOffice && filters.offices.length > 0 ? (
            <label className="block text-sm">
              <span className="font-medium text-brand-black/80">Office</span>
              <select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">All offices</option>
                {filters.offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {filters?.canFilterByEs && filters.esUsers.length > 0 ? (
            <label className="block text-sm">
              <span className="font-medium text-brand-black/80">Employment specialist</span>
              <select
                value={esUserId}
                onChange={(e) => setEsUserId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              >
                <option value="">All Employment Specialists</option>
                {filters.esUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={exportHref}
            className="inline-flex rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
          >
            Export client facts (CSV)
          </a>
        </div>
      </section>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-brand-black/60">Loading analytics…</p>
      ) : summary ? (
        <>
          {benchmark ? (
            <section className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-5">
              <h2 className="text-base font-semibold text-brand-black">Outcome benchmark</h2>
              <p className="mt-1 text-sm text-brand-black/65">
                Compared to the prior period of equal length in your scope.
              </p>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2 text-sm">
                <li className="rounded-lg border border-neutral-100 bg-white px-4 py-3">
                  <span className="font-medium">Hire rate</span>
                  <p className="mt-1 text-brand-black/80">
                    {formatPercent(benchmark.current.hireRate)} now
                    {benchmark.hireRateDeltaPct != null
                      ? ` · ${benchmark.hireRateDeltaPct >= 0 ? "+" : ""}${benchmark.hireRateDeltaPct.toFixed(1)}% vs prior`
                      : null}
                  </p>
                </li>
                <li className="rounded-lg border border-neutral-100 bg-white px-4 py-3">
                  <span className="font-medium">Median days to hire</span>
                  <p className="mt-1 text-brand-black/80">
                    {benchmark.current.medianDaysToHire ?? "—"} days now
                    {benchmark.medianDaysToHireDelta != null
                      ? ` · ${benchmark.medianDaysToHireDelta >= 0 ? "+" : ""}${benchmark.medianDaysToHireDelta} days vs prior`
                      : null}
                  </p>
                </li>
              </ul>
            </section>
          ) : null}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              title={ANALYTICS_METRIC_DEFINITIONS.activeCaseload.label}
              value={String(summary.activeCaseload)}
              hint={ANALYTICS_METRIC_DEFINITIONS.activeCaseload.description}
            />
            <MetricCard
              title={ANALYTICS_METRIC_DEFINITIONS.clientsHired.label}
              value={String(summary.clientsHired)}
              hint={ANALYTICS_METRIC_DEFINITIONS.clientsHired.description}
            />
            <MetricCard
              title={ANALYTICS_METRIC_DEFINITIONS.hireRate.label}
              value={formatPercent(summary.hireRate)}
              hint={ANALYTICS_METRIC_DEFINITIONS.hireRate.description}
            />
            <MetricCard
              title={ANALYTICS_METRIC_DEFINITIONS.medianDaysToHire.label}
              value={
                summary.medianDaysToHire != null ? `${summary.medianDaysToHire} days` : "—"
              }
              hint={ANALYTICS_METRIC_DEFINITIONS.medianDaysToHire.description}
            />
            <MetricCard
              title={ANALYTICS_METRIC_DEFINITIONS.applicationsSubmitted.label}
              value={String(summary.applicationsSubmitted)}
              hint={ANALYTICS_METRIC_DEFINITIONS.applicationsSubmitted.description}
            />
          </section>

          {summary.monthly.length > 0 ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-brand-black">Monthly trends</h2>
              <p className="mt-1 text-sm text-brand-black/65">
                Intakes and hires by calendar month within the selected range. Monthly hire rate
                is hires ÷ intakes for that month.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 text-brand-black/70">
                      <th className="py-2 pr-4 font-medium">Month</th>
                      <th className="py-2 pr-4 font-medium">Intakes</th>
                      <th className="py-2 pr-4 font-medium">Hires</th>
                      <th className="py-2 font-medium">Hire rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((row) => (
                      <tr key={row.month} className="border-b border-neutral-100">
                        <td className="py-2 pr-4">{formatMonthLabel(row.month)}</td>
                        <td className="py-2 pr-4">{row.intakes}</td>
                        <td className="py-2 pr-4">{row.hires}</td>
                        <td className="py-2">{formatPercent(row.hireRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {summary.applicationsByStatus.length > 0 ? (
            <section className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
              <h2 className="text-base font-semibold text-brand-black">Applications by status</h2>
              <p className="mt-1 text-sm text-brand-black/65">
                Applications submitted in the selected date range.
              </p>
              <ul className="mt-4 space-y-2">
                {summary.applicationsByStatus.map((row) => (
                  <li
                    key={row.status}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="text-brand-black">{row.status}</span>
                    <span className="font-semibold tabular-nums text-brand-green">
                      {row.count}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-xl border border-brand-green/20 bg-brand-green/5 p-5">
            <h2 className="text-base font-semibold text-brand-black">How these numbers are calculated</h2>
            <dl className="mt-3 space-y-3 text-sm text-brand-black/80">
              {Object.entries(ANALYTICS_METRIC_DEFINITIONS).map(([key, def]) => (
                <div key={key}>
                  <dt className="font-medium text-brand-black">{def.label}</dt>
                  <dd className="mt-0.5">{def.description}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
  hint: string;
}) {
  return (
    <article
      className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
      title={hint}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">{title}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums text-brand-black">{value}</p>
      <p className="mt-2 text-xs text-brand-black/60">{hint}</p>
    </article>
  );
}
