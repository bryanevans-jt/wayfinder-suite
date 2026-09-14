"use client";

import { PreEtsAuthorizationFinalizeModal } from "@/components/pre-ets-authorization-finalize-modal";
import { useCallback, useEffect, useMemo, useState } from "react";

type PipelineStatus =
  | "awaiting_spreadsheet"
  | "pending_authorization"
  | "roster_submitted";

type PipelineRow = {
  schoolId: string;
  schoolName: string;
  groupName: string;
  programGroupId: string | null;
  authorizationId: string | null;
  serviceMonth: string;
  status: PipelineStatus;
  studentCount: number;
  authNumber: string | null;
  authType: string | null;
  serviceCode: string | null;
  instructorName: string | null;
  classTime: string | null;
};

const STATUS_OPTIONS: { id: PipelineStatus | "all"; label: string }[] = [
  { id: "all", label: "All statuses" },
  { id: "awaiting_spreadsheet", label: "Awaiting spreadsheet" },
  { id: "pending_authorization", label: "Pending authorization" },
  { id: "roster_submitted", label: "Roster submitted" },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

function statusBadgeClass(status: PipelineStatus): string {
  switch (status) {
    case "awaiting_spreadsheet":
      return "bg-neutral-100 text-brand-black/75";
    case "pending_authorization":
      return "bg-amber-100 text-amber-950";
    case "roster_submitted":
      return "bg-brand-green/15 text-brand-green";
  }
}

function statusLabel(status: PipelineStatus): string {
  return STATUS_OPTIONS.find((o) => o.id === status)?.label ?? status;
}

export function PreEtsPipelinePanel() {
  const defaultMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const [month, setMonth] = useState(defaultMonth);
  const [status, setStatus] = useState<PipelineStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [rows, setRows] = useState<PipelineRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [canFinalize, setCanFinalize] = useState(false);
  const [editTarget, setEditTarget] = useState<PipelineRow | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<PipelineRow | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [month, status, searchDebounced, pageSize]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pre-ets/access");
      const data = (await res.json()) as { access?: { canFinalizeAuthorizations?: boolean } };
      if (res.ok) setCanFinalize(data.access?.canFinalizeAuthorizations ?? false);
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      month,
      page: String(page),
      pageSize: String(pageSize),
      status,
    });
    if (searchDebounced) params.set("search", searchDebounced);

    const res = await fetch(`/api/pre-ets/pipeline?${params.toString()}`);
    const data = (await res.json()) as {
      rows?: PipelineRow[];
      total?: number;
      totalPages?: number;
      error?: string;
    };
    if (res.ok) {
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    }
    setLoading(false);
  }, [month, page, pageSize, status, searchDebounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Schools &amp; groups</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Track each school or group through Awaiting spreadsheet → Pending authorization → Roster
          submitted. Search and filter to find a site quickly.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
        <label className="text-sm">
          <span className="font-medium">Service month</span>
          <input
            type="month"
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="font-medium">Search</span>
          <input
            type="search"
            placeholder="School, group, auth #, instructor…"
            className="mt-1 block w-full rounded-lg border border-neutral-300 px-3 py-2"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="font-medium">Status</span>
          <select
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={status}
            onChange={(e) => setStatus(e.target.value as PipelineStatus | "all")}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="font-medium">Per page</span>
          <select
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-sm text-brand-black/60">
        {loading
          ? "Loading…"
          : total === 0
            ? "No schools or groups match these filters."
            : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">School / group</th>
              <th className="px-3 py-2">Students</th>
              <th className="px-3 py-2">Auth #</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-brand-black/55">
                  No rows on this page.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={`${row.schoolId}-${row.programGroupId ?? "none"}-${row.groupName}`} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-brand-black">{row.groupName}</p>
                    {row.groupName !== row.schoolName ? (
                      <p className="text-xs text-brand-black/55">{row.schoolName}</p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.studentCount}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.authNumber ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-brand-black/75">
                    {row.instructorName ?? "—"}
                    {row.classTime ? ` · ${row.classTime}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {row.authorizationId && row.status === "pending_authorization" ? (
                        <>
                          {canFinalize ? (
                            <>
                              <button
                                type="button"
                                className="text-brand-green hover:underline"
                                onClick={() => setEditTarget(row)}
                              >
                                Edit roster
                              </button>
                              <button
                                type="button"
                                className="font-semibold text-brand-gold hover:underline"
                                onClick={() => setFinalizeTarget(row)}
                              >
                                Enter authorization
                              </button>
                            </>
                          ) : null}
                        </>
                      ) : null}
                      {row.status === "roster_submitted" && row.authorizationId ? (
                        <a
                          href={`/api/pre-ets/authorizations/${row.authorizationId}/roster-pdf`}
                          className="text-brand-green hover:underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Print PDF
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={page <= 1 || loading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-brand-black/70">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-50"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      ) : null}

      {editTarget?.authorizationId ? (
        <PreEtsAuthorizationFinalizeModal
          mode="edit"
          authorizationId={editTarget.authorizationId}
          schoolLabel={`${editTarget.groupName}${editTarget.groupName !== editTarget.schoolName ? ` · ${editTarget.schoolName}` : ""}`}
          onClose={() => setEditTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {finalizeTarget?.authorizationId ? (
        <PreEtsAuthorizationFinalizeModal
          authorizationId={finalizeTarget.authorizationId}
          schoolLabel={`${finalizeTarget.groupName}${finalizeTarget.groupName !== finalizeTarget.schoolName ? ` · ${finalizeTarget.schoolName}` : ""}`}
          onClose={() => setFinalizeTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  );
}
