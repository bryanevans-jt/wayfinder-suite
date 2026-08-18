"use client";

import { useCallback, useEffect, useState } from "react";

type ComplianceRow = {
  sessionId: string;
  sessionDate: string | null;
  schoolName: string | null;
  authNumber: string | null;
  isLate: boolean;
  missingRoster: boolean;
  missingCar: boolean;
  hoursPastDue: number | null;
};

export function PreEtsCompliancePanel() {
  const [sessions, setSessions] = useState<ComplianceRow[]>([]);
  const [onlyLate, setOnlyLate] = useState(true);
  const [deadlineHours, setDeadlineHours] = useState(24);

  const load = useCallback(async () => {
    const accessRes = await fetch("/api/pre-ets/access");
    const accessData = (await accessRes.json()) as {
      settings?: { submission_deadline_hours?: number };
    };
    if (accessRes.ok && accessData.settings?.submission_deadline_hours) {
      setDeadlineHours(accessData.settings.submission_deadline_hours);
    }

    const qs = onlyLate ? "?onlyLate=1" : "";
    const res = await fetch(`/api/pre-ets/compliance${qs}`);
    const data = (await res.json()) as { sessions?: ComplianceRow[] };
    if (res.ok) setSessions(data.sessions ?? []);
  }, [onlyLate]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-brand-black">Documentation compliance</h2>
          <p className="mt-1 text-sm text-brand-black/65">
            Sessions past the {deadlineHours}-hour deadline without a signed roster upload and/or
            submitted class activity report. Cancelled sessions are excluded.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyLate}
            onChange={(e) => setOnlyLate(e.target.checked)}
          />
          Show overdue only
        </label>
      </div>

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
            {sessions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
                  {onlyLate ? "No overdue documentation." : "No sessions with dates on file."}
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
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
