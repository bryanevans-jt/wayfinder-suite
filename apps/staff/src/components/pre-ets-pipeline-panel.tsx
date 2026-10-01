"use client";

import { PreEtsAuthorizationFinalizeModal } from "@/components/pre-ets-authorization-finalize-modal";
import { PreEtsProgramGroupCombineModal } from "@/components/pre-ets-program-group-combine-modal";
import { PreEtsProgramGroupLabelsModal } from "@/components/pre-ets-program-group-labels-modal";
import { PreEtsServiceCodeDisplay } from "@/components/pre-ets-service-code-display";
import type { PreEtsServiceCodeRow } from "@wayfinder/supabase/pre-ets-settings";
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
  hidden?: boolean;
  mergedIntoProgramGroupId?: string | null;
  mergedIntoGroupName?: string | null;
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
  const [canEditServiceCode, setCanEditServiceCode] = useState(false);
  const [editTarget, setEditTarget] = useState<PipelineRow | null>(null);
  const [finalizeTarget, setFinalizeTarget] = useState<PipelineRow | null>(null);
  const [labelsTarget, setLabelsTarget] = useState<PipelineRow | null>(null);
  const [canEditGroupLabels, setCanEditGroupLabels] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [combineSource, setCombineSource] = useState<PipelineRow | null>(null);
  const [serviceCodes, setServiceCodes] = useState<PreEtsServiceCodeRow[]>([]);
  const [combineCandidates, setCombineCandidates] = useState<
    { programGroupId: string; groupName: string; instructorName: string | null }[]
  >([]);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [month, status, searchDebounced, pageSize, includeHidden]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/pre-ets/access");
      const data = (await res.json()) as {
        access?: {
          canFinalizeAuthorizations?: boolean;
          canEditAuthorizationServiceCode?: boolean;
          canManageSetup?: boolean;
          canSupervise?: boolean;
          canAccounts?: boolean;
          canManageSettings?: boolean;
        };
        settings?: { service_codes?: PreEtsServiceCodeRow[] };
      };
      if (res.ok) {
        setServiceCodes(data.settings?.service_codes ?? []);
        setCanFinalize(data.access?.canFinalizeAuthorizations ?? false);
        setCanEditServiceCode(data.access?.canEditAuthorizationServiceCode ?? false);
        setCanEditGroupLabels(
          Boolean(
            data.access?.canManageSetup || data.access?.canSupervise || data.access?.canAccounts
          )
        );
      }
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
    if (includeHidden) params.set("includeHidden", "1");

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
  }, [month, page, pageSize, status, searchDebounced, includeHidden]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  async function onHideGroup(row: PipelineRow) {
    if (!row.programGroupId || row.hidden) return;
    const label =
      row.groupName !== row.schoolName
        ? `${row.schoolName} · ${row.groupName}`
        : row.groupName;
    if (
      !window.confirm(
        `Hide "${label}" from Schools & groups?\n\nData is kept. Re-uploading a worksheet with this group header and student PIDs can show it again.`
      )
    ) {
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/pre-ets/program-groups/${row.programGroupId}/hide`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Hidden from pipeline" }),
    });
    const data = (await res.json()) as { error?: string };
    setLoading(false);
    if (!res.ok) {
      window.alert(data.error ?? "Could not hide group");
      return;
    }
    void load();
  }

  async function onRestoreGroup(row: PipelineRow) {
    if (!row.programGroupId || !row.hidden) return;
    setLoading(true);
    const res = await fetch(`/api/pre-ets/program-groups/${row.programGroupId}/restore`, {
      method: "POST",
    });
    const data = (await res.json()) as { error?: string };
    setLoading(false);
    if (!res.ok) {
      window.alert(data.error ?? "Could not restore group");
      return;
    }
    void load();
  }

  async function openCombine(row: PipelineRow) {
    if (!row.programGroupId) return;
    const res = await fetch(
      `/api/pre-ets/program-groups?month=${encodeURIComponent(month)}&schoolId=${encodeURIComponent(row.schoolId)}`
    );
    const data = (await res.json()) as {
      groups?: Array<{ id: string; group_name: string; instructor_name: string | null }>;
    };
    if (!res.ok) {
      window.alert("Could not load groups for this school.");
      return;
    }
    setCombineCandidates(
      (data.groups ?? []).map((g) => ({
        programGroupId: g.id,
        groupName: g.group_name,
        instructorName: g.instructor_name,
      }))
    );
    setCombineSource(row);
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">Schools &amp; groups</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Track each school or group through Awaiting spreadsheet → Pending authorization → Roster
          submitted. Use <strong className="font-medium">Fix labels</strong> to correct names,{" "}
          <strong className="font-medium">Hide group</strong> when a class is not taught this month, or{" "}
          <strong className="font-medium">Combine</strong> when two spreadsheet groups are one class.
          Hidden groups can return when a worksheet upload includes them with PIDs again.
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
        <label className="flex items-center gap-2 pb-2 text-sm">
          <input
            type="checkbox"
            checked={includeHidden}
            onChange={(e) => setIncludeHidden(e.target.checked)}
          />
          <span>Show hidden groups</span>
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
              <th className="px-3 py-2">Service code</th>
              <th className="px-3 py-2">Instructor</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-brand-black/55">
                  No rows on this page.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={`${row.schoolId}-${row.programGroupId ?? "none"}-${row.groupName}`}
                  className={`border-t border-neutral-100 ${row.hidden ? "bg-neutral-50/90" : ""}`}
                >
                  <td className="px-3 py-2">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(row.status)}`}
                    >
                      {row.hidden ? "Hidden" : statusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <p className="font-medium text-brand-black">{row.groupName}</p>
                    {row.groupName !== row.schoolName ? (
                      <p className="text-xs text-brand-black/55">{row.schoolName}</p>
                    ) : null}
                    {row.hidden && row.mergedIntoGroupName ? (
                      <p className="text-xs text-brand-black/50">
                        Combined into {row.mergedIntoGroupName}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{row.studentCount}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.authNumber ?? "—"}</td>
                  <td className="px-3 py-2">
                    <PreEtsServiceCodeDisplay code={row.serviceCode} serviceCodes={serviceCodes} />
                  </td>
                  <td className="px-3 py-2 text-xs text-brand-black/75">
                    {row.instructorName ?? "—"}
                    {row.classTime ? ` · ${row.classTime}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {canEditGroupLabels && row.programGroupId ? (
                        <button
                          type="button"
                          className="text-brand-black/80 hover:underline"
                          onClick={() => setLabelsTarget(row)}
                        >
                          Fix labels
                        </button>
                      ) : null}
                      {canEditGroupLabels && row.programGroupId && !row.hidden ? (
                        <>
                          <button
                            type="button"
                            className="text-brand-black/65 hover:underline"
                            onClick={() => void onHideGroup(row)}
                          >
                            Hide group
                          </button>
                          <button
                            type="button"
                            className="text-brand-black/65 hover:underline"
                            onClick={() => void openCombine(row)}
                          >
                            Combine…
                          </button>
                        </>
                      ) : null}
                      {canEditGroupLabels && row.programGroupId && row.hidden ? (
                        <button
                          type="button"
                          className="text-brand-green hover:underline"
                          onClick={() => void onRestoreGroup(row)}
                        >
                          Restore
                        </button>
                      ) : null}
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
          canEditServiceCode={canEditServiceCode}
          onClose={() => setEditTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}

      {finalizeTarget?.authorizationId ? (
        <PreEtsAuthorizationFinalizeModal
          authorizationId={finalizeTarget.authorizationId}
          schoolLabel={`${finalizeTarget.groupName}${finalizeTarget.groupName !== finalizeTarget.schoolName ? ` · ${finalizeTarget.schoolName}` : ""}`}
          canEditServiceCode={canEditServiceCode}
          onClose={() => setFinalizeTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}

      <PreEtsProgramGroupCombineModal
        open={combineSource !== null}
        sourceProgramGroupId={combineSource?.programGroupId ?? null}
        sourceLabel={
          combineSource
            ? `${combineSource.groupName}${combineSource.groupName !== combineSource.schoolName ? ` · ${combineSource.schoolName}` : ""}`
            : ""
        }
        candidates={combineCandidates}
        onClose={() => setCombineSource(null)}
        onCombined={() => void load()}
      />

      {labelsTarget?.programGroupId ? (
        <PreEtsProgramGroupLabelsModal
          programGroupId={labelsTarget.programGroupId}
          initialSchoolName={labelsTarget.schoolName}
          initialGroupName={labelsTarget.groupName}
          initialInstructorName={labelsTarget.instructorName}
          onClose={() => setLabelsTarget(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </section>
  );
}
