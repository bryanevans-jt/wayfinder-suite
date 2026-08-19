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
  const [phase, setPhase] = useState<"planning" | "auth_match">("planning");
  const [preview, setPreview] = useState<{
    importId: string;
    parsed: ParsedDistrictWorksheet;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ytdWarnings, setYtdWarnings] = useState<YtdWarning[]>([]);
  const [authMatchStats, setAuthMatchStats] = useState<AuthMatchStats | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/pre-ets/worksheets");
    const data = (await res.json()) as { imports?: ImportRow[] };
    if (res.ok) setImports(data.imports ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onUpload(file: File) {
    setBusy(true);
    setMessage(null);
    const form = new FormData();
    form.set("file", file);
    form.set("phase", phase);
    const res = await fetch("/api/pre-ets/worksheets", { method: "POST", body: form });
    const data = (await res.json()) as {
      import?: { id: string };
      parsed?: ParsedDistrictWorksheet;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
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
      status?: string;
      districtId?: string;
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
      setMessage("Worksheet approved. You can now commit to rosters and authorizations.");
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
    const archiveNote = data.archivedToDrive
      ? " Archived to Google Drive."
      : data.archiveError
        ? ` Drive archive skipped: ${data.archiveError}`
        : "";
    const matchNote = data.authMatchStats
      ? ` Matched ${data.authMatchStats.authorizationsMatched} pending authorization(s); ${data.authMatchStats.authorizationsCreated} new; ${data.authMatchStats.pendingAuthsRemaining} pending remaining.`
      : "";
    setMessage(
      `Worksheet committed to rosters and authorizations.${archiveNote}${matchNote}${
        (data.ytdWarnings?.length ?? 0) > 0
          ? ` ${data.ytdWarnings?.length} YTD warning(s) — review below.`
          : ""
      }`
    );
    setPreview(null);
    void load();
  }

  async function commitImport(importId: string) {
    await worksheetAction(importId, "commit");
  }

  async function approveImport(importId: string) {
    await worksheetAction(importId, "approve");
  }

  async function rejectImport(importId: string) {
    const reason = window.prompt("Rejection reason (required):");
    if (!reason?.trim()) return;
    await worksheetAction(importId, "reject", reason.trim());
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">District worksheet import</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          Upload your monthly district CSV (Phase 1: planning before GVRA auth; Phase 2: auth match
          when authorization numbers arrive).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="font-medium">Import phase</span>
          <select
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
            value={phase}
            onChange={(e) => setPhase(e.target.value as "planning" | "auth_match")}
          >
            <option value="planning">Phase 1 — Planning (before GVRA auth)</option>
            <option value="auth_match">Phase 2 — Auth match (after GVRA auth)</option>
          </select>
        </label>
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

      {preview ? (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <h3 className="font-semibold text-brand-black">Parse preview</h3>
          <p className="mt-1 text-sm text-brand-black/70">
            District {preview.parsed.districtNumber ?? "—"} · {preview.parsed.monthLabel}{" "}
            {preview.parsed.schoolYear} · {preview.parsed.stats.officeCount} offices ·{" "}
            {preview.parsed.stats.groupCount} groups · {preview.parsed.stats.studentCount} students
          </p>
          {preview.parsed.issues.length > 0 ? (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-amber-900">
              {preview.parsed.issues.slice(0, 20).map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 max-h-64 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-3 text-xs">
            {preview.parsed.offices.map((office) => (
              <div key={office.name} className="mb-3">
                <p className="font-semibold">{office.name}</p>
                {office.groups.map((g) => (
                  <div key={g.headerRaw} className="ml-3 mt-1 text-brand-black/75">
                    <p>{g.groupName}</p>
                    <p className="text-brand-black/55">
                      {g.instructorName ?? "—"} · {g.students.length} students
                    </p>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            type="button"
            disabled={busy}
            className="mt-4 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white"
            onClick={() => void approveImport(preview.importId)}
          >
            Approve worksheet
          </button>
          <button
            type="button"
            disabled={busy}
            className="mt-4 ml-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800"
            onClick={() => void rejectImport(preview.importId)}
          >
            Reject
          </button>
        </div>
      ) : null}

      {authMatchStats ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <h3 className="font-semibold text-brand-black">Auth match results</h3>
          <dl className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
            <div>
              <dt className="text-brand-black/55">Pending auths matched</dt>
              <dd className="font-semibold">{authMatchStats.authorizationsMatched}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">New auths created</dt>
              <dd className="font-semibold">{authMatchStats.authorizationsCreated}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">Roster rows updated</dt>
              <dd className="font-semibold">{authMatchStats.rosterEntriesUpdated}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">Pending auths remaining</dt>
              <dd className="font-semibold">{authMatchStats.pendingAuthsRemaining}</dd>
            </div>
          </dl>
          {authMatchStats.unmatchedStudents.length > 0 ? (
            <ul className="mt-3 max-h-32 overflow-y-auto text-xs text-amber-950">
              {authMatchStats.unmatchedStudents.map((row) => (
                <li key={`${row.participantId}-${row.fullName}`}>
                  {row.fullName} (PID {row.participantId}) — {row.reason}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {ytdWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-amber-950">YTD unit warnings</h3>
          <p className="mt-1 text-amber-900/80">
            These students meet or exceed the configured warning threshold. Import was not blocked.
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-amber-950">
            {ytdWarnings.map((w) => (
              <li key={w.participantId}>
                {w.fullName} (PID {w.participantId}) — current YTD {w.currentYtd}, adding{" "}
                {w.unitsAdding} (threshold {w.threshold})
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
              <th className="px-3 py-2">Drive</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-brand-black/55">
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
                  <td className="px-3 py-2 text-xs text-brand-black/60">
                    {row.drive_file_name ?? (row.archived_at ? "archived" : "—")}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2 text-xs">
                      {row.status === "parsed" ? (
                        <>
                          <button
                            type="button"
                            className="text-brand-green hover:underline"
                            disabled={busy}
                            onClick={() => void approveImport(row.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="text-red-700 hover:underline"
                            disabled={busy}
                            onClick={() => void rejectImport(row.id)}
                          >
                            Reject
                          </button>
                        </>
                      ) : null}
                      {row.status === "approved" ? (
                        <button
                          type="button"
                          className="text-brand-green hover:underline"
                          disabled={busy}
                          onClick={() => void commitImport(row.id)}
                        >
                          Commit
                        </button>
                      ) : null}
                      {row.status === "rejected" && row.parse_result?._meta?.rejectionReason ? (
                        <span className="text-brand-black/55">
                          {row.parse_result._meta.rejectionReason}
                        </span>
                      ) : null}
                    </div>
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
