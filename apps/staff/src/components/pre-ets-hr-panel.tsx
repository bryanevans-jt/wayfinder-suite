"use client";

import { useCallback, useEffect, useState } from "react";

type HrSummary = {
  overdueSessions: number;
  missingRoster: number;
  missingCar: number;
  activeSchools: number;
  invoicePackets: {
    draft: number;
    ready: number;
    submitted: number;
    paid: number;
  };
  submissionDeadlineHours: number;
  ytdWarningThreshold: number;
  schoolYear: string;
};

type OverdueRow = {
  sessionId: string;
  sessionDate: string | null;
  schoolName: string | null;
  authNumber: string | null;
  missingRoster: boolean;
  missingCar: boolean;
  hoursPastDue: number | null;
};

type School = { id: string; name: string };

export function PreEtsHrPanel() {
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolId, setSchoolId] = useState("");
  const [summary, setSummary] = useState<HrSummary | null>(null);
  const [overdue, setOverdue] = useState<OverdueRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const schoolRes = await fetch("/api/pre-ets/schools");
    const schoolData = (await schoolRes.json()) as { schools?: School[] };
    if (schoolRes.ok) setSchools(schoolData.schools ?? []);

    const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
    const res = await fetch(`/api/pre-ets/hr-summary${qs}`);
    const data = (await res.json()) as {
      summary?: HrSummary;
      overdueSessions?: OverdueRow[];
      error?: string;
    };
    if (!res.ok) {
      setError(data.error ?? "Could not load HR summary.");
      return;
    }
    setSummary(data.summary ?? null);
    setOverdue(data.overdueSessions ?? []);
  }, [schoolId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return <p className="text-sm text-red-700">{error}</p>;
  }

  if (!summary) {
    return <p className="text-sm text-brand-black/60">Loading HR overview…</p>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">HR oversight (view only)</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            School year {summary.schoolYear}. Read-only snapshot of documentation compliance and
            invoice packet status. Contact Accounts or Supervisors for changes.
          </p>
        </div>
        <label className="text-sm">
          <span className="mr-2 text-brand-black/70">School</span>
          <select
            className="rounded-lg border border-neutral-300 px-2 py-1.5"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
          >
            <option value="">All schools</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Overdue sessions" value={summary.overdueSessions} highlight={summary.overdueSessions > 0} />
        <StatCard label="Missing roster" value={summary.missingRoster} />
        <StatCard label="Missing CAR" value={summary.missingCar} />
        <StatCard label="Schools" value={summary.activeSchools} />
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h3 className="font-semibold text-brand-black">Invoice packets</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-brand-black/55">Draft</dt>
            <dd className="text-lg font-semibold">{summary.invoicePackets.draft}</dd>
          </div>
          <div>
            <dt className="text-brand-black/55">Ready</dt>
            <dd className="text-lg font-semibold">{summary.invoicePackets.ready}</dd>
          </div>
          <div>
            <dt className="text-brand-black/55">Submitted</dt>
            <dd className="text-lg font-semibold">{summary.invoicePackets.submitted}</dd>
          </div>
          <div>
            <dt className="text-brand-black/55">Paid</dt>
            <dd className="text-lg font-semibold">{summary.invoicePackets.paid}</dd>
          </div>
        </dl>
      </div>

      <p className="text-xs text-brand-black/55">
        Documentation deadline: {summary.submissionDeadlineHours} hours after session date. YTD
        unit warning threshold: {summary.ytdWarningThreshold} units per school year.
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Session date</th>
              <th className="px-3 py-2">School</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Missing roster</th>
              <th className="px-3 py-2">Missing CAR</th>
              <th className="px-3 py-2">Hours past due</th>
            </tr>
          </thead>
          <tbody>
            {overdue.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  No overdue documentation on file.
                </td>
              </tr>
            ) : (
              overdue.map((s) => (
                <tr key={s.sessionId} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{s.sessionDate ?? "—"}</td>
                  <td className="px-3 py-2">{s.schoolName ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{s.authNumber ?? "—"}</td>
                  <td className="px-3 py-2">{s.missingRoster ? "Yes" : "—"}</td>
                  <td className="px-3 py-2">{s.missingCar ? "Yes" : "—"}</td>
                  <td className="px-3 py-2">
                    {s.hoursPastDue != null ? s.hoursPastDue.toFixed(1) : "—"}
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

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-amber-300 bg-amber-50" : "border-neutral-200 bg-white"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-brand-black/55">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand-black">{value}</p>
    </div>
  );
}
