"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeFormalReportPageSize,
  paginateFormalReportRows,
  type FormalReportPageSize,
} from "@/lib/formal-report-history";

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
  serviceId?: string | null;
  serviceName?: string | null;
  isPriorService?: boolean;
};

type Props = {
  clientId: string;
};

export function SubmittedFormalReportsPanel({ clientId }: Props) {
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<FormalReportPageSize>(10);

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
      setPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load submitted reports");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const paged = useMemo(
    () => paginateFormalReportRows(rows, { page, pageSize }),
    [rows, page, pageSize]
  );

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Submitted Official Reports
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Every official PDF filed for this client across all services (newest first). Reports from a
        previous service are marked Prior service. Links open in Google Drive when available.
      </p>

      {loading ? <p className="mt-3 text-sm text-brand-black/60">Loading…</p> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}

      {!loading && !error && rows.length === 0 ? (
        <p className="mt-3 text-sm text-brand-black/60">No official reports submitted yet for this client.</p>
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-brand-black/65">
            <p>
              Showing {paged.pageRows.length} of {paged.total}
              {pageSize === "all" ? "" : ` · page ${paged.page} of ${paged.pageCount}`}
            </p>
            <label className="inline-flex items-center gap-1.5">
              Per page
              <select
                className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                value={pageSize === "all" ? "all" : String(pageSize)}
                onChange={(e) => {
                  setPageSize(normalizeFormalReportPageSize(e.target.value));
                  setPage(1);
                }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="all">All</option>
              </select>
            </label>
          </div>

          <ul className="mt-2 divide-y divide-neutral-100">
            {paged.pageRows.map((row) => (
              <li key={row.id} className="py-3 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-brand-black">{row.reportLabel}</p>
                    <p className="text-xs text-brand-black/60">
                      {[row.state, row.reportingMonth, row.submittedByName]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {row.isPriorService && row.serviceName ? (
                      <p className="mt-0.5 text-xs font-medium text-amber-900">
                        Prior service · {row.serviceName}
                      </p>
                    ) : row.serviceName ? (
                      <p className="mt-0.5 text-xs text-brand-black/55">{row.serviceName}</p>
                    ) : null}
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
                    <span className="text-xs text-brand-black/45">
                      {row.driveFileName ?? "PDF filed"}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {pageSize !== "all" && paged.pageCount > 1 ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium disabled:opacity-40"
                disabled={paged.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="rounded border border-neutral-300 px-3 py-1 text-xs font-medium disabled:opacity-40"
                disabled={paged.page >= paged.pageCount}
                onClick={() => setPage((p) => Math.min(paged.pageCount, p + 1))}
              >
                Next
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
