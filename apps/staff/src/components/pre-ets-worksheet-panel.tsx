"use client";

import type { ParsedDistrictWorksheet } from "@wayfinder/supabase/pre-ets-worksheet-parser";
import { useCallback, useEffect, useState } from "react";

type ImportRow = {
  id: string;
  service_month: string;
  school_year: string;
  phase: string;
  status: string;
  file_name: string | null;
  drive_file_name: string | null;
  archived_at: string | null;
  created_at: string;
  committed_at: string | null;
  parse_result?: { _meta?: { rejectionReason?: string } };
};

type YtdWarning = {
  participantId: string;
  fullName: string;
  currentYtd: number;
  unitsAdding: number;
  threshold: number;
};

type AuthMatchStats = {
  authorizationsMatched: number;
  authorizationsCreated: number;
  rosterEntriesUpdated: number;
  unmatchedStudents: Array<{ participantId: string; fullName: string; reason: string }>;
  pendingAuthsRemaining: number;
};

export function PreEtsWorksheetPanel() {
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [panelRole, setPanelRole] = useState<"supervisor" | "accounts">("supervisor");
  const [isSuperAdminUploader, setIsSuperAdminUploader] = useState(false);
  const [preview, setPreview] = useState<{
    importId: string;
    parsed: ParsedDistrictWorksheet;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ytdWarnings, setYtdWarnings] = useState<YtdWarning[]>([]);
  const [authMatchStats, setAuthMatchStats] = useState<AuthMatchStats | null>(null);
  const [schoolGroupLabels, setSchoolGroupLabels] = useState<string[]>([]);

  const isSupervisorMode = panelRole === "supervisor";

  const load = useCallback(async () => {
    const [sheetRes, accessRes] = await Promise.all([
      fetch("/api/pre-ets/worksheets"),
      fetch("/api/pre-ets/access"),
    ]);
    const data = (await sheetRes.json()) as { imports?: ImportRow[]; role?: "supervisor" | "accounts" };
    const access = (await accessRes.json()) as {
      access?: { canManageSettings?: boolean; canUploadPlanningWorksheets?: boolean };
    };
    if (sheetRes.ok) {
      setImports(data.imports ?? []);
      if (data.role) setPanelRole(data.role);
    }
    setIsSuperAdminUploader(
      Boolean(access.access?.canManageSettings && access.access?.canUploadPlanningWorksheets)
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File) {
    setBusy(true);
    setMessage(null);
    setAuthMatchStats(null);
    setSchoolGroupLabels([]);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/pre-ets/worksheets", { method: "POST", body: form });
    const data = (await res.json()) as {
      import?: { id: string };
      parsed?: ParsedDistrictWorksheet;
      committed?: boolean;
      ytdWarnings?: YtdWarning[];
      authMatchStats?: AuthMatchStats | null;
      schoolGroupLabels?: string[];
      archivedToDrive?: boolean;
      archiveError?: string | null;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }

    if (data.committed) {
      setYtdWarnings(data.ytdWarnings ?? []);
      setAuthMatchStats(data.authMatchStats ?? null);
      setSchoolGroupLabels(data.schoolGroupLabels ?? []);
      const groups = data.schoolGroupLabels?.length
        ? ` Authorization requests submitted for ${data.schoolGroupLabels.join(", ")}. Accounts were notified.`
        : "";
      setMessage(
        `Worksheet committed. Pending rosters are ready for authorization numbers.${groups}${
          (data.ytdWarnings?.length ?? 0) > 0
            ? ` ${data.ytdWarnings?.length} YTD warning(s) — review below.`
            : ""
        }`
      );
      setPreview(null);
      void load();
      return;
    }

    if (data.import?.id && data.parsed) {
      setPreview({ importId: data.import.id, parsed: data.parsed });
    }
    void load();
  }

  async function worksheetAction(importId: string, action: "approve" | "reject" | "commit", reason?: string) {
    setBusy(true);
    setMessage(null);
    setAuthMatchStats(null);
    const res = await fetch(`/api/pre-ets/worksheets/${importId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ytdWarnings?: YtdWarning[];
      authMatchStats?: AuthMatchStats | null;
      archivedToDrive?: boolean;
      archiveError?: string | null;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? `${action} failed`);
      return;
    }

    if (action === "approve") {
      setMessage("Worksheet approved. You can commit when ready.");
      setPreview(null);
      void load();
      return;
    }

    if (action === "reject") {
      setMessage("Worksheet rejected.");
      setPreview(null);
      void load();
      return;
    }

    setYtdWarnings(data.ytdWarnings ?? []);
    setAuthMatchStats(data.authMatchStats ?? null);
    setMessage("Worksheet committed.");
    setPreview(null);
    void load();
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">District worksheet import</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          {isSuperAdminUploader
            ? "Upload any district planning CSV (no authorization numbers required). Pending rosters commit immediately for the whole district in the file."
            : isSupervisorMode
              ? "Upload your monthly district CSV before GVRA authorization numbers are available. Pending rosters are created immediately; you can re-upload the same month to add schools or students."
              : "Support uploads and review import history. Supervisors normally upload planning worksheets; enter authorization numbers under Rosters & auths when GVRA responds."}
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="cursor-pointer rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white">
          {busy ? "Uploading…" : "Upload CSV"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onUpload(f);
            }}
          />
        </label>
      </div>

      {message ? <p className="text-sm text-brand-black/70">{message}</p> : null}

      {schoolGroupLabels.length > 0 ? (
        <p className="text-sm text-brand-black/75">
          Groups in this upload: {schoolGroupLabels.join(", ")}
        </p>
      ) : null}

      {preview && !isSupervisorMode ? (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <h3 className="font-semibold text-brand-black">Parse preview</h3>
          <p className="mt-1 text-sm text-brand-black/70">
            District {preview.parsed.districtNumber ?? "—"} · {preview.parsed.monthLabel}{" "}
            {preview.parsed.schoolYear}
          </p>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void worksheetAction(preview.importId, "approve")}
          >
            Approve worksheet
          </button>
        </div>
      ) : null}

      {authMatchStats ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <h3 className="font-semibold text-brand-black">Import results</h3>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-brand-black/55">Pending auths matched</dt>
              <dd className="font-semibold">{authMatchStats.authorizationsMatched}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">New pending auths</dt>
              <dd className="font-semibold">{authMatchStats.authorizationsCreated}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">Roster rows updated</dt>
              <dd className="font-semibold">{authMatchStats.rosterEntriesUpdated}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">Pending auths remaining (district)</dt>
              <dd className="font-semibold">{authMatchStats.pendingAuthsRemaining}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      {ytdWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-amber-950">YTD unit warnings</h3>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-amber-950">
            {ytdWarnings.map((w) => (
              <li key={w.participantId}>
                {w.fullName} (PID {w.participantId})
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-neutral-50 text-brand-black/70">
            <tr>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Month</th>
              <th className="px-3 py-2">Phase</th>
              <th className="px-3 py-2">Status</th>
              {!isSupervisorMode ? <th className="px-3 py-2">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td colSpan={isSupervisorMode ? 5 : 6} className="px-3 py-6 text-center text-brand-black/55">
                  No worksheet imports yet.
                </td>
              </tr>
            ) : (
              imports.map((row) => (
                <tr key={row.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{new Date(row.created_at).toLocaleString()}</td>
                  <td className="px-3 py-2">{row.file_name ?? "—"}</td>
                  <td className="px-3 py-2">{row.service_month?.slice(0, 7)}</td>
                  <td className="px-3 py-2">{row.phase}</td>
                  <td className="px-3 py-2">{row.status}</td>
                  {!isSupervisorMode ? (
                    <td className="px-3 py-2 text-xs">
                      {row.status === "parsed" ? (
                        <button
                          type="button"
                          className="text-brand-green hover:underline"
                          onClick={() => void worksheetAction(row.id, "approve")}
                        >
                          Approve
                        </button>
                      ) : null}
                      {row.status === "approved" ? (
                        <button
                          type="button"
                          className="text-brand-green hover:underline"
                          onClick={() => void worksheetAction(row.id, "commit")}
                        >
                          Commit
                        </button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
