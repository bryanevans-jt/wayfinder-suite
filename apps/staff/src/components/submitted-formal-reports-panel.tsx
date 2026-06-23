"use client";

import { useCallback, useEffect, useState } from "react";

type SubmissionRow = {
  id: string;
  reportType: string;
  reportLabel: string;
  state: string;
  reportingMonth: string | null;
  submittedByName: string | null;
  driveFileName: string | null;
  driveUrl: string | null;
  createdAt: string;
};

type Props = {
  clientId: string;
};

export function SubmittedFormalReportsPanel({ clientId }: Props) {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/clients/${clientId}/formal-reports`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Could not load submitted reports");
      }
      const data = (await res.json()) as { submissions: SubmissionRow[] };
      setRows(data.submissions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submitted reports");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Submitted formal reports
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        PDFs filed through formal reporting. Links open in Google Drive when available.
      </p>

      {loading ? <p className="mt-3 text-sm text-brand-black/60">Loading…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-3 text-sm text-brand-black/60">No formal reports submitted yet for this client.</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="mt-3 divide-y divide-neutral-100">
          {rows.map((row) => (
            <li key={row.id} className="py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium text-brand-black">{row.reportLabel}</p>
                  <p className="text-xs text-brand-black/60">
                    {[row.state, row.reportingMonth, row.submittedByName].filter(Boolean).join(" · ")}
                  </p>
                  <p className="text-xs text-brand-black/50">
                    {new Date(row.createdAt).toLocaleString("en-US")}
                  </p>
                </div>
                {row.driveUrl ? (
                  <a
                    href={row.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-brand-green hover:underline"
                  >
                    Open PDF
                  </a>
                ) : (
                  <span className="text-xs text-brand-black/45">{row.driveFileName ?? "PDF filed"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
