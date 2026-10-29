"use client";

import type { KraBillableComplianceRollup, KraStaffComplianceRow } from "@wayfinder/supabase/kra-billable-compliance";
import { formatBillableHours } from "@wayfinder/supabase/client-billable";
import { useCallback, useEffect, useMemo, useState } from "react";

function monthInputValue(monthKey: string): string {
  return `${monthKey}-01`;
}

function monthKeyFromInput(value: string): string {
  return value.slice(0, 7);
}

type Props = {
  initialMonthKey: string;
  canCloseMonth: boolean;
};

export function BillableHoursKraCompliancePanel({ initialMonthKey, canCloseMonth }: Props) {
  const [monthKey, setMonthKey] = useState(initialMonthKey);
  const [payload, setPayload] = useState<KraBillableComplianceRollup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  const load = useCallback(async (key: string) => {
    setLoading(true);
    setError(null);
    const res = await fetch(
      `/api/admin/kra-billable-compliance?month=${encodeURIComponent(key)}`
    );
    const data = (await res.json()) as KraBillableComplianceRollup & { error?: string };
    if (!res.ok) {
      setError(data.error ?? "Could not load KRA compliance");
      setPayload(null);
    } else {
      setPayload(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load(monthKey);
  }, [monthKey, load]);

  const sortedRows = useMemo(() => {
    if (!payload?.rows) return [];
    return [...payload.rows].sort((a, b) => {
      const aRate = a.inScopeClientCount ? a.metCount / a.inScopeClientCount : 1;
      const bRate = b.inScopeClientCount ? b.metCount / b.inScopeClientCount : 1;
      if (aRate !== bRate) return aRate - bRate;
      return a.staffName.localeCompare(b.staffName);
    });
  }, [payload]);

  async function closeMonth() {
    if (!payload || payload.frozen) return;
    if (
      !window.confirm(
        `Freeze KRA compliance for ${payload.monthLabel}? This snapshot will not change if caseload or time entries are edited later.`
      )
    ) {
      return;
    }
    setClosing(true);
    const res = await fetch("/api/admin/kra-billable-compliance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "close", month: monthKey }),
    });
    setClosing(false);
    if (res.ok) {
      await load(monthKey);
    } else {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Could not close month");
    }
  }

  return (
    <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-brand-green">Client billable expectations (KRA)</h2>
          <p className="mt-1 max-w-3xl text-sm text-brand-black/70">
            Per ES/Transition Specialist: average billable hours per in-scope IJP/TSE client and how
            many clients met the monthly threshold. KRA totals use the full client-month billable
            pool (including GVRA 2 hr allowance and hours logged by prior assignees). Payroll still
            credits only the person who logged each entry.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-brand-black/70">Month</span>
            <input
              type="month"
              className="rounded-md border border-neutral-300 px-3 py-2 text-brand-black"
              value={monthInputValue(monthKey)}
              onChange={(e) => setMonthKey(monthKeyFromInput(e.target.value))}
            />
          </label>
          {canCloseMonth && payload && !payload.frozen ? (
            <button
              type="button"
              disabled={closing}
              onClick={() => void closeMonth()}
              className="rounded-lg border border-neutral-300 px-3 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-60"
            >
              {closing ? "Closing…" : "Close month (freeze)"}
            </button>
          ) : null}
        </div>
      </div>

      {payload?.frozen ? (
        <p className="mt-2 text-xs text-brand-black/55">
          Frozen snapshot
          {payload.closedAt ? ` · closed ${new Date(payload.closedAt).toLocaleString()}` : ""}.
        </p>
      ) : null}

      {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
      {loading ? (
        <p className="mt-4 text-sm text-brand-black/60">Loading…</p>
      ) : sortedRows.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/60">No field staff or in-scope clients for this month.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-brand-black/60">
                <th className="py-2 pr-4 font-medium">Team member</th>
                <th className="py-2 pr-4 font-medium">Expectations met</th>
                <th className="py-2 pr-4 font-medium">Avg hrs / client</th>
                <th className="py-2 font-medium">In-scope clients</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <StaffRow
                  key={row.staffUserId}
                  row={row}
                  expanded={expandedStaffId === row.staffUserId}
                  onToggle={() =>
                    setExpandedStaffId((id) =>
                      id === row.staffUserId ? null : row.staffUserId
                    )
                  }
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function StaffRow({
  row,
  expanded,
  onToggle,
}: {
  row: KraStaffComplianceRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct =
    row.inScopeClientCount > 0
      ? Math.round((row.metCount / row.inScopeClientCount) * 100)
      : null;
  return (
    <>
      <tr className="border-b border-neutral-100">
        <td className="py-2 pr-4">
          <button
            type="button"
            onClick={onToggle}
            className="font-medium text-brand-green hover:underline"
          >
            {row.staffName}
          </button>
        </td>
        <td className="py-2 pr-4 tabular-nums">
          <span className={row.missedCount > 0 ? "text-amber-900" : "text-brand-black"}>
            {row.complianceLabel}
          </span>
          {pct !== null ? (
            <span className="ml-2 text-xs text-brand-black/50">({pct}%)</span>
          ) : null}
        </td>
        <td className="py-2 pr-4 tabular-nums font-medium">{row.averageBillableHoursPerClient}</td>
        <td className="py-2 tabular-nums">{row.inScopeClientCount}</td>
      </tr>
      {expanded ? (
        <tr className="border-b border-neutral-100 bg-neutral-50/80">
          <td colSpan={4} className="px-3 py-3">
            {row.clients.length === 0 ? (
              <p className="text-sm text-brand-black/60">No in-scope clients this month.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {row.clients.map((c) => (
                  <li
                    key={c.clientId}
                    className={`rounded-lg border px-3 py-2 ${
                      c.met ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-brand-black">{c.clientName}</span>
                      <span className="tabular-nums">
                        {c.kraBillableHours} / {c.thresholdHours.toFixed(1)} hr
                        {c.met ? " · met" : " · below"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-brand-black/65">
                      Toward KRA: {formatBillableHours(c.loggedBySelfMinutes)} logged by this ES/TS,{" "}
                      {formatBillableHours(c.loggedByOthersMinutes)} from other assignee(s) this
                      month
                      {c.gvraAllowanceMinutes > 0
                        ? ` · includes ${formatBillableHours(c.gvraAllowanceMinutes)} GVRA allowance on client`
                        : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </td>
        </tr>
      ) : null}
    </>
  );
}
