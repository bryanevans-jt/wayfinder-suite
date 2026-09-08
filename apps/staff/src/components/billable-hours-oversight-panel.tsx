"use client";

import { useEffect, useState } from "react";

type Row = {
  esUserId: string;
  esName: string;
  billableMinutes: number;
  billableHours: string;
};

export function BillableHoursOversightPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [period, setPeriod] = useState<{ start: string; end: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch("/api/exports/billable-hours-summary");
      const data = (await res.json()) as {
        period?: { start: string; end: string };
        rows?: Row[];
      };
      if (!cancelled && res.ok) {
        setPeriod(data.period ?? null);
        setRows(data.rows ?? []);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="text-lg font-semibold text-brand-green">Billable hours (pay period)</h2>
      <p className="mt-1 text-sm text-brand-black/70">
        Total client billable hours logged by each Employment Specialist for the current pay
        period. Used for compliance and payroll oversight.
      </p>
      {period ? (
        <p className="mt-2 text-xs text-brand-black/55">
          Period: {period.start} – {period.end}
        </p>
      ) : null}
      {loading ? (
        <p className="mt-4 text-sm text-brand-black/60">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-brand-black/60">No billable hours logged this period.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-brand-black/60">
                <th className="py-2 pr-4 font-medium">Employment Specialist</th>
                <th className="py-2 font-medium">Billable hours</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.esUserId} className="border-b border-neutral-100">
                  <td className="py-2 pr-4 text-brand-black">{r.esName}</td>
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
