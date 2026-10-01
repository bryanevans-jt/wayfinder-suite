"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type MetricsMonth = {
  serviceMonth: string;
  programGroupCount: number;
  uniqueStudentCount: number;
  uniqueSchoolCount: number;
  lastWorksheetCommittedAt: string | null;
};

type MetricsSnapshot = {
  schoolYear: string | null;
  current: MetricsMonth | null;
  history: MetricsMonth[];
};

function formatMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const monthNum = Number.parseInt(m ?? "", 10);
  if (!Number.isFinite(monthNum)) return ym;
  const date = new Date(Number.parseInt(y ?? "2000", 10), monthNum - 1, 1);
  return date.toLocaleString(undefined, { month: "short", year: "numeric" });
}

function delta(current: number, previous: number | null): string | null {
  if (previous === null) return null;
  const diff = current - previous;
  if (diff === 0) return "—";
  return diff > 0 ? `+${diff}` : String(diff);
}

export function PreEtsServingMetricsPanel() {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pre-ets/serving-metrics?allSchoolYears=1");
    const data = (await res.json()) as MetricsSnapshot & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Could not load serving metrics");
      return;
    }
    setSnapshot(data);
    setSelectedMonth((prev) => prev || data.current?.serviceMonth || "");
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const historyWithTrend = useMemo(() => {
    if (!snapshot?.history.length) return [];
    return snapshot.history.map((row, index) => {
      const prev = index > 0 ? snapshot.history[index - 1] : null;
      return {
        ...row,
        groupDelta: delta(row.programGroupCount, prev?.programGroupCount ?? null),
        studentDelta: delta(row.uniqueStudentCount, prev?.uniqueStudentCount ?? null),
      };
    });
  }, [snapshot?.history]);

  const focus =
    snapshot?.history.find((h) => h.serviceMonth === selectedMonth) ?? snapshot?.current ?? null;

  const maxStudents = Math.max(1, ...historyWithTrend.map((h) => h.uniqueStudentCount));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Students &amp; groups served</h2>
        <p className="mt-1 max-w-2xl text-sm text-brand-black/70">
          Counts come from committed worksheet rosters for each billing month. Only students with a{" "}
          <strong>PID #</strong> on the spreadsheet are included (NOT APPROVED rows are excluded).
          Hidden or merged program groups are excluded. Numbers refresh after each worksheet upload
          or re-parse.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">{error}</p>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-brand-black/80">Billing month</span>
          <select
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            value={selectedMonth}
            disabled={busy || !snapshot?.history.length}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {(snapshot?.history ?? []).map((row) => (
              <option key={row.serviceMonth} value={row.serviceMonth}>
                {formatMonthLabel(row.serviceMonth)}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium hover:bg-neutral-50"
          disabled={busy}
          onClick={() => void load()}
        >
          {busy ? "Loading…" : "Refresh"}
        </button>
        <p className="text-xs text-brand-black/55">Includes all billing months with roster data.</p>
      </div>

      {focus ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">
              Program groups
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-black">{focus.programGroupCount}</p>
            <p className="mt-1 text-xs text-brand-black/60">{formatMonthLabel(focus.serviceMonth)}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">
              Students (unique PID)
            </p>
            <p className="mt-2 text-3xl font-bold text-brand-black">{focus.uniqueStudentCount}</p>
            <p className="mt-1 text-xs text-brand-black/60">{formatMonthLabel(focus.serviceMonth)}</p>
          </div>
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/55">Schools</p>
            <p className="mt-2 text-3xl font-bold text-brand-black">{focus.uniqueSchoolCount}</p>
            <p className="mt-1 text-xs text-brand-black/60">With at least one eligible student</p>
          </div>
        </div>
      ) : !busy ? (
        <p className="text-sm text-brand-black/60">No roster data yet for this school year.</p>
      ) : null}

      {historyWithTrend.length > 1 ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-brand-black">Student trend (unique PID)</h3>
          <div className="mt-4 flex items-end gap-1 overflow-x-auto pb-2" aria-hidden>
            {historyWithTrend.map((row) => {
              const height = Math.max(8, Math.round((row.uniqueStudentCount / maxStudents) * 120));
              return (
                <div key={row.serviceMonth} className="flex min-w-[2.5rem] flex-col items-center gap-1">
                  <div
                    className="w-6 rounded-t bg-brand-green/70"
                    style={{ height: `${height}px` }}
                    title={`${formatMonthLabel(row.serviceMonth)}: ${row.uniqueStudentCount} students`}
                  />
                  <span className="text-[10px] text-brand-black/50">
                    {row.serviceMonth.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {historyWithTrend.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-neutral-50 text-brand-black/70">
              <tr>
                <th className="px-3 py-2">Month</th>
                <th className="px-3 py-2">Program groups</th>
                <th className="px-3 py-2">Δ groups</th>
                <th className="px-3 py-2">Students (PID)</th>
                <th className="px-3 py-2">Δ students</th>
                <th className="px-3 py-2">Schools</th>
                <th className="px-3 py-2">Last worksheet commit</th>
              </tr>
            </thead>
            <tbody>
              {[...historyWithTrend].reverse().map((row) => (
                <tr key={row.serviceMonth} className="border-t border-neutral-100">
                  <td className="px-3 py-2 font-medium">{formatMonthLabel(row.serviceMonth)}</td>
                  <td className="px-3 py-2">{row.programGroupCount}</td>
                  <td className="px-3 py-2 text-brand-black/60">{row.groupDelta ?? "—"}</td>
                  <td className="px-3 py-2">{row.uniqueStudentCount}</td>
                  <td className="px-3 py-2 text-brand-black/60">{row.studentDelta ?? "—"}</td>
                  <td className="px-3 py-2">{row.uniqueSchoolCount}</td>
                  <td className="px-3 py-2 text-xs text-brand-black/55">
                    {row.lastWorksheetCommittedAt
                      ? new Date(row.lastWorksheetCommittedAt).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
