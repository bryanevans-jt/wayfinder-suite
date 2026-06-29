"use client";

import { formatPortalDateTime } from "@/lib/portal-datetime";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useEffect, useState } from "react";

type ErrorLogRow = {
  id: string;
  errorCode: string;
  createdAt: string;
  app: string;
  route: string;
  userName: string | null;
  userRoleLabel: string | null;
  statusCode: number | null;
  technicalMessage: string;
  stackTrace: string | null;
};

type ErrorLogSummary = {
  total24h: number;
  total7d: number;
  staff7d: number;
  client7d: number;
  reports7d: number;
};

export function ErrorLogPanel() {
  const [logs, setLogs] = useState<ErrorLogRow[]>([]);
  const [summary, setSummary] = useState<ErrorLogSummary | null>(null);
  const [codeFilter, setCodeFilter] = useState("");
  const [appFilter, setAppFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (codeFilter.trim()) params.set("code", codeFilter.trim());
      if (appFilter) params.set("app", appFilter);
      const res = await fetch(`/api/portal/error-logs?${params.toString()}`);
      const data = (await res.json()) as {
        logs?: ErrorLogRow[];
        summary?: ErrorLogSummary;
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      setLogs(data.logs ?? []);
      setSummary(data.summary ?? null);
    } catch (e) {
      setError(friendlyClientError(e));
    } finally {
      setLoading(false);
    }
  }, [codeFilter, appFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(null);
    }
  }

  return (
    <section className="mt-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Error log</h2>
        <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
          System errors are logged here with a reference code. End users only see a supportive
          message — share a code here to get help diagnosing an issue quickly.
        </p>
      </div>

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">Last 24 hours</p>
            <p className="mt-1 text-2xl font-semibold text-brand-black">{summary.total24h}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">Last 7 days</p>
            <p className="mt-1 text-2xl font-semibold text-brand-black">{summary.total7d}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">Wayfinder Pro (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-brand-black">{summary.staff7d}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">Wayfinder (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-brand-black">{summary.client7d}</p>
          </div>
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">Reports (7d)</p>
            <p className="mt-1 text-2xl font-semibold text-brand-black">{summary.reports7d}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/80">Error code</span>
          <input
            type="search"
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            placeholder="WF-XXXXXXXX"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-brand-black/80">App</span>
          <select
            value={appFilter}
            onChange={(e) => setAppFilter(e.target.value)}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none ring-brand-green focus:ring-2"
          >
            <option value="">All</option>
            <option value="staff">Team Member</option>
            <option value="client">Client</option>
            <option value="reports">Reports</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90"
        >
          Refresh
        </button>
      </div>

      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Date & time</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Account level</th>
              <th className="px-3 py-2">Error code</th>
              <th className="px-3 py-2">App</th>
              <th className="px-3 py-2">Route</th>
              <th className="px-3 py-2">Details</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-brand-black/60">
                  Loading…
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-brand-black/60">
                  No errors logged yet.
                </td>
              </tr>
            ) : (
              logs.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 text-brand-black/80">
                    <time dateTime={row.createdAt}>{formatPortalDateTime(row.createdAt)}</time>
                  </td>
                  <td className="px-3 py-2">{row.userName ?? "—"}</td>
                  <td className="px-3 py-2">{row.userRoleLabel ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-xs">
                        {row.errorCode}
                      </code>
                      <button
                        type="button"
                        onClick={() => void copyCode(row.errorCode)}
                        className="text-xs font-semibold text-brand-green underline underline-offset-2"
                      >
                        {copiedCode === row.errorCode ? "Copied" : "Copy"}
                      </button>
                    </div>
                  </td>
                  <td className="px-3 py-2 capitalize">{row.app}</td>
                  <td className="max-w-[12rem] truncate px-3 py-2 font-mono text-xs text-brand-black/70">
                    {row.route}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                      className="text-xs font-semibold text-brand-green underline underline-offset-2"
                    >
                      {expandedId === row.id ? "Hide" : "View"}
                    </button>
                    {expandedId === row.id ? (
                      <div className="mt-2 max-w-xl space-y-2 rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs">
                        {row.statusCode ? (
                          <p>
                            <span className="font-semibold">Status:</span> {row.statusCode}
                          </p>
                        ) : null}
                        <p>
                          <span className="font-semibold">Message:</span> {row.technicalMessage}
                        </p>
                        {row.stackTrace ? (
                          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[11px] text-brand-black/70">
                            {row.stackTrace}
                          </pre>
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
