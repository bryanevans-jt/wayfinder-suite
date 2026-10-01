"use client";

import type { ParsedDistrictWorksheet } from "@wayfinder/supabase/pre-ets-worksheet-parser";
import {
  PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE,
  preEtsTestRosterZipDownloadUrl,
  preEtsTestRosterZipPartCount,
} from "@/lib/pre-ets-test-roster-export-config";
import { useCallback, useEffect, useRef, useState } from "react";

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
  instructorSchoolsAssigned?: number;
  instructorNamesIgnored?: number;
  pendingAuthsRemaining: number;
};

type SchoolNameWarning = {
  worksheetSchoolName: string;
  resolvedSchoolName: string;
  source: "worksheet" | "setup" | "existing";
  ambiguousCandidates?: string[];
};

type SkippedEmptyGroup = {
  schoolName: string;
  groupName: string;
  headerRaw: string;
};

type ServingMetricsSummary = {
  serviceMonth: string;
  programGroupCount: number;
  uniqueStudentCount: number;
  uniqueSchoolCount: number;
};

type TestRosterRow = {
  authorizationId: string;
  fileLabel: string;
  schoolName: string;
  groupName: string;
  eligibleStudentCount: number;
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
  const [schoolNameWarnings, setSchoolNameWarnings] = useState<SchoolNameWarning[]>([]);
  const [schoolGroupLabels, setSchoolGroupLabels] = useState<string[]>([]);
  const [parseIssues, setParseIssues] = useState<string[]>([]);
  const [skippedEmptyGroups, setSkippedEmptyGroups] = useState<SkippedEmptyGroup[]>([]);
  const [testingOverrideEnabled, setTestingOverrideEnabled] = useState(false);
  const [canManageTestingOverride, setCanManageTestingOverride] = useState(false);
  const [emailRosterMonth, setEmailRosterMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [rosterExportBusy, setRosterExportBusy] = useState(false);
  const [rosterExportProgress, setRosterExportProgress] = useState<string | null>(null);
  const [testRosterList, setTestRosterList] = useState<TestRosterRow[] | null>(null);
  const [servingMetrics, setServingMetrics] = useState<ServingMetricsSummary | null>(null);
  const rosterSequentialCancelRef = useRef(false);

  const loadServingMetrics = useCallback(async () => {
    const res = await fetch("/api/pre-ets/serving-metrics?allSchoolYears=1");
    if (!res.ok) return;
    const data = (await res.json()) as { current?: ServingMetricsSummary | null };
    if (data.current) {
      setServingMetrics(data.current);
    }
  }, []);

  const isSupervisorMode = panelRole === "supervisor";

  const load = useCallback(async () => {
    const [sheetRes, accessRes, overrideRes] = await Promise.all([
      fetch("/api/pre-ets/worksheets"),
      fetch("/api/pre-ets/access"),
      fetch("/api/pre-ets/worksheets/testing-override"),
    ]);
    const data = (await sheetRes.json()) as { imports?: ImportRow[]; role?: "supervisor" | "accounts" };
    const access = (await accessRes.json()) as {
      access?: {
        canManageSettings?: boolean;
        canUploadPlanningWorksheets?: boolean;
        canManageWorksheetTestingOverride?: boolean;
      };
      settings?: { worksheet_testing_override_enabled?: boolean };
    };
    if (sheetRes.ok) {
      setImports(data.imports ?? []);
      if (data.role) setPanelRole(data.role);
    }
    setIsSuperAdminUploader(
      Boolean(access.access?.canManageSettings && access.access?.canUploadPlanningWorksheets)
    );
    if (overrideRes.ok) {
      const override = (await overrideRes.json()) as { enabled?: boolean; canManage?: boolean };
      setTestingOverrideEnabled(Boolean(override.enabled));
      setCanManageTestingOverride(Boolean(override.canManage));
    } else if (accessRes.ok) {
      setTestingOverrideEnabled(
        Boolean(access.settings?.worksheet_testing_override_enabled)
      );
      setCanManageTestingOverride(Boolean(access.access?.canManageWorksheetTestingOverride));
    }
  }, []);

  useEffect(() => {
    void load();
    void loadServingMetrics();
  }, [load, loadServingMetrics]);

  function applyServingMetricsFromResponse(metrics: ServingMetricsSummary | null | undefined) {
    if (metrics?.serviceMonth) {
      setServingMetrics(metrics);
    } else {
      void loadServingMetrics();
    }
  }

  async function onUpload(file: File) {
    setBusy(true);
    setMessage(null);
    setAuthMatchStats(null);
    setSchoolGroupLabels([]);
    setSchoolNameWarnings([]);
    setParseIssues([]);
    setSkippedEmptyGroups([]);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/pre-ets/worksheets", { method: "POST", body: form });
    const data = (await res.json()) as {
      import?: { id: string };
      parsed?: ParsedDistrictWorksheet;
      committed?: boolean;
      multi?: boolean;
      importCount?: number;
      failedCount?: number;
      districts?: Array<{
        ok: boolean;
        sheetName?: string;
        fileLabel?: string;
        error?: string;
        parsed?: ParsedDistrictWorksheet;
        schoolGroupLabels?: string[];
      }>;
      ytdWarnings?: YtdWarning[];
      authMatchStats?: AuthMatchStats | null;
      schoolGroupLabels?: string[];
      schoolNameWarnings?: SchoolNameWarning[];
      skippedEmptyGroups?: SkippedEmptyGroup[];
      servingMetrics?: ServingMetricsSummary | null;
      archivedToDrive?: boolean;
      archiveError?: string | null;
      error?: string;
    };
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Upload failed");
      return;
    }

    if (data.parsed?.issues?.length) {
      setParseIssues(data.parsed.issues);
    }

    if (data.multi && data.districts?.length) {
      const okRows = data.districts.filter((d) => d.ok);
      const badRows = data.districts.filter((d) => !d.ok);
      const labels = okRows.flatMap((d) => d.schoolGroupLabels ?? []);
      setSchoolGroupLabels(labels);
      setSkippedEmptyGroups(
        okRows.flatMap(
          (d) =>
            (d as { skippedEmptyGroups?: SkippedEmptyGroup[] }).skippedEmptyGroups?.map((g) => ({
              ...g,
              schoolName: d.sheetName ? `${g.schoolName} (${d.sheetName})` : g.schoolName,
            })) ?? []
        )
      );
      setParseIssues(
        badRows.flatMap((d) =>
          (d.parsed?.issues ?? []).map((issue) => `${d.sheetName ?? "Sheet"}: ${issue}`)
        )
      );
      setMessage(
        `Imported ${okRows.length} district tab(s) from workbook.${
          badRows.length ? ` ${badRows.length} tab(s) skipped — see flags below.` : ""
        }${testingOverrideEnabled ? " Testing override is ON." : ""}`
      );
      setPreview(null);
      void load();
      return;
    }

    if (data.committed) {
      setYtdWarnings(data.ytdWarnings ?? []);
      setAuthMatchStats(data.authMatchStats ?? null);
      setSchoolGroupLabels(data.schoolGroupLabels ?? []);
      setSchoolNameWarnings(data.schoolNameWarnings ?? []);
      setSkippedEmptyGroups(data.skippedEmptyGroups ?? []);
      const groups = data.schoolGroupLabels?.length
        ? ` Authorization requests submitted for ${data.schoolGroupLabels.join(", ")}. Accounts were notified.`
        : "";
      const issueNote =
        (data.parsed?.issues?.length ?? 0) > 0
          ? ` ${data.parsed?.issues.length} spreadsheet flag(s) — review below.`
          : "";
      const skippedNote =
        (data.skippedEmptyGroups?.length ?? 0) > 0
          ? ` ${data.skippedEmptyGroups?.length} group(s) had no eligible students and were skipped (see below).`
          : "";
      applyServingMetricsFromResponse(data.servingMetrics);
      const metricsNote = data.servingMetrics
        ? ` This billing month: ${data.servingMetrics.programGroupCount} program groups, ${data.servingMetrics.uniqueStudentCount} students with PID.`
        : "";
      setMessage(
        `Worksheet committed.${metricsNote}${testingOverrideEnabled ? " Testing override is ON — rosters are admin-only until auth numbers are entered." : " Pending rosters are ready for authorization numbers."}${groups}${skippedNote}${issueNote}${
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
      setParseIssues(data.parsed.issues ?? []);
    }
    void load();
  }

  async function worksheetAction(
    importId: string,
    action: "approve" | "reject" | "commit" | "reprocess",
    reason?: string
  ) {
    setBusy(true);
    setMessage(null);
    setAuthMatchStats(null);
    setSchoolNameWarnings([]);
    setSkippedEmptyGroups([]);
    const res = await fetch(`/api/pre-ets/worksheets/${importId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = (await res.json()) as {
      ok?: boolean;
      ytdWarnings?: YtdWarning[];
      authMatchStats?: AuthMatchStats | null;
      schoolNameWarnings?: SchoolNameWarning[];
      skippedEmptyGroups?: SkippedEmptyGroup[];
      servingMetrics?: ServingMetricsSummary | null;
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

    if (action === "reprocess") {
      const reprocessData = data as {
        reparsedGroupCount?: number;
        reparsedStudentCount?: number;
      };
      applyServingMetricsFromResponse(data.servingMetrics);
      setYtdWarnings(data.ytdWarnings ?? []);
      setAuthMatchStats(data.authMatchStats ?? null);
      setSchoolNameWarnings(data.schoolNameWarnings ?? []);
      setSkippedEmptyGroups(data.skippedEmptyGroups ?? []);
      setMessage(
        `Re-parsed stored file (${reprocessData.reparsedGroupCount ?? "—"} groups, ${reprocessData.reparsedStudentCount ?? "—"} students) and rebuilt rosters for this district month.${
          data.archivedToDrive ? " Archived to Google Drive." : ""
        }`
      );
      void load();
      return;
    }

    setYtdWarnings(data.ytdWarnings ?? []);
    setAuthMatchStats(data.authMatchStats ?? null);
    setSchoolNameWarnings(data.schoolNameWarnings ?? []);
    setSkippedEmptyGroups(data.skippedEmptyGroups ?? []);
    const archiveNote = data.archivedToDrive
      ? " Archived to Google Drive."
      : data.archiveError
        ? ` Drive archive skipped: ${data.archiveError}`
        : "";
    const matchNote = data.authMatchStats
      ? ` Matched ${data.authMatchStats.authorizationsMatched} pending authorization(s); ${data.authMatchStats.authorizationsCreated} new; ${data.authMatchStats.pendingAuthsRemaining} pending remaining.`
      : "";
    const skippedNote =
      (data.skippedEmptyGroups?.length ?? 0) > 0
        ? ` ${data.skippedEmptyGroups?.length} group(s) had no eligible students and were skipped (see below).`
        : "";
    applyServingMetricsFromResponse(data.servingMetrics);
    const metricsNote = data.servingMetrics
      ? ` Billing month totals: ${data.servingMetrics.programGroupCount} groups, ${data.servingMetrics.uniqueStudentCount} students (PID).`
      : "";
    setMessage(
      `Worksheet committed to rosters and authorizations.${metricsNote}${archiveNote}${matchNote}${skippedNote}${
        (data.ytdWarnings?.length ?? 0) > 0
          ? ` ${data.ytdWarnings?.length} YTD warning(s) — review below.`
          : ""
      }`
    );
    setPreview(null);
    void load();
  }

  async function loadTestRosterList() {
    setRosterExportBusy(true);
    setRosterExportProgress("Loading roster list…");
    setMessage(null);
    const res = await fetch(
      `/api/pre-ets/worksheets/test-rosters?serviceMonth=${encodeURIComponent(emailRosterMonth)}`
    );
    const data = (await res.json()) as { error?: string; rosters?: TestRosterRow[] };
    setRosterExportBusy(false);
    setRosterExportProgress(null);
    if (!res.ok) {
      setTestRosterList(null);
      setMessage(data.error ?? "Could not load test rosters");
      return;
    }
    setTestRosterList(data.rosters ?? []);
    setMessage(
      (data.rosters?.length ?? 0) === 0
        ? `No rosters with eligible students (PID required) for ${emailRosterMonth}.`
        : `Found ${data.rosters?.length ?? 0} roster(s) for ${emailRosterMonth}. Use ZIP parts (up to ${PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE} PDFs each), sequential PDF download, or individual links below.`
    );
  }

  async function ensureTestRosterList(): Promise<TestRosterRow[] | null> {
    if (testRosterList?.length) return testRosterList;
    setRosterExportProgress("Loading roster list…");
    const listRes = await fetch(
      `/api/pre-ets/worksheets/test-rosters?serviceMonth=${encodeURIComponent(emailRosterMonth)}`
    );
    const listData = (await listRes.json()) as { error?: string; rosters?: TestRosterRow[] };
    setRosterExportProgress(null);
    if (!listRes.ok) {
      setMessage(listData.error ?? "Could not load test rosters");
      return null;
    }
    const rosters = listData.rosters ?? [];
    setTestRosterList(rosters);
    return rosters;
  }

  async function onDownloadAllPdfsSequentially() {
    setRosterExportBusy(true);
    setMessage(null);
    rosterSequentialCancelRef.current = false;
    try {
      const rosters = await ensureTestRosterList();
      if (!rosters?.length) {
        if (rosters && rosters.length === 0) {
          setMessage(`No rosters with eligible students for ${emailRosterMonth}.`);
        }
        return;
      }

      let downloaded = 0;
      for (let i = 0; i < rosters.length; i++) {
        if (rosterSequentialCancelRef.current) {
          setMessage(`Stopped sequential download after ${downloaded} PDF(s).`);
          return;
        }
        const row = rosters[i];
        setRosterExportProgress(`Downloading PDF ${i + 1} of ${rosters.length}…`);

        const pdfRes = await fetch(
          `/api/pre-ets/authorizations/${row.authorizationId}/roster-pdf`
        );
        if (!pdfRes.ok) {
          const err = (await pdfRes.json().catch(() => ({}))) as { error?: string };
          setMessage(err.error ?? `Stopped at ${row.fileLabel} (${pdfRes.status}).`);
          return;
        }

        const blob = await pdfRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = objectUrl;
        anchor.download = `${row.fileLabel.replace(/[^\w\s.-]/g, "").trim() || "roster"}.pdf`;
        anchor.click();
        URL.revokeObjectURL(objectUrl);
        downloaded++;

        if (i < rosters.length - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1200));
        }
      }

      setMessage(`Started download of ${downloaded} PDF(s) for ${emailRosterMonth}.`);
    } finally {
      setRosterExportBusy(false);
      setRosterExportProgress(null);
    }
  }

  function onCancelRosterExport() {
    rosterSequentialCancelRef.current = true;
  }

  async function onEmailTestRosters() {
    setRosterExportBusy(true);
    setMessage(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 4 * 60 * 1000);
    try {
      const res = await fetch("/api/pre-ets/worksheets/email-test-rosters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceMonth: emailRosterMonth }),
        signal: controller.signal,
      });
      const data = (await res.json()) as {
        error?: string;
        rosterCount?: number;
        emailedTo?: string;
        skippedEmpty?: number;
      };
      if (!res.ok) {
        setMessage(data.error ?? "Could not email test rosters");
        return;
      }
      setMessage(
        `Emailed ${data.rosterCount ?? 0} roster PDF(s) as a ZIP to ${data.emailedTo ?? "you"} for ${emailRosterMonth}.${
          (data.skippedEmpty ?? 0) > 0 ? ` Skipped ${data.skippedEmpty} empty authorization(s).` : ""
        }`
      );
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      setMessage(
        aborted
          ? "Email export timed out after 4 minutes. Use “Download ZIP (browser)” or open individual PDFs below — large months are too heavy for one server email."
          : "Could not email test rosters. Try Download ZIP (browser) instead."
      );
    } finally {
      window.clearTimeout(timeout);
      setRosterExportBusy(false);
    }
  }

  async function onToggleTestingOverride(enabled: boolean) {
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/pre-ets/worksheets/testing-override", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    const data = (await res.json()) as { enabled?: boolean; error?: string };
    setBusy(false);
    if (!res.ok) {
      setMessage(data.error ?? "Could not update testing override");
      return;
    }
    setTestingOverrideEnabled(Boolean(data.enabled));
    setMessage(
      data.enabled
        ? "Worksheet testing override enabled. Upload without auth numbers; only Admin and Super Admin can view unreleased rosters."
        : "Worksheet testing override disabled. Normal Pre-ETS visibility rules apply."
    );
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-brand-black">District worksheet import</h2>
        <p className="mt-1 text-sm text-brand-black/65">
          {testingOverrideEnabled
            ? "Testing override is on: upload CSV or Excel (.xlsx/.xls) without authorization numbers. Rows without a PID # are skipped."
            : isSuperAdminUploader
              ? "Upload a district CSV or a multi-tab Excel workbook (one district per sheet). Pending rosters commit immediately per district tab."
              : isSupervisorMode
                ? "Upload CSV or Excel before GVRA authorization numbers are available. Excel workbooks can use one tab per district; CSV is one district per file."
                : "Support uploads and review import history. Supervisors normally upload planning worksheets; enter authorization numbers under Rosters & auths when GVRA responds."}
        </p>
      </div>

      {servingMetrics ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm">
          <p className="font-semibold text-brand-black">
            Currently serving ({servingMetrics.serviceMonth.slice(0, 7)})
          </p>
          <p className="mt-1 text-brand-black/75">
            <strong>{servingMetrics.programGroupCount}</strong> program groups ·{" "}
            <strong>{servingMetrics.uniqueStudentCount}</strong> students with PID ·{" "}
            <strong>{servingMetrics.uniqueSchoolCount}</strong> schools
          </p>
          <p className="mt-1 text-xs text-brand-black/55">
            Updates when worksheets commit or re-parse. Open the{" "}
            <strong>Serving analytics</strong> tab for month-over-month history and trends.
          </p>
        </div>
      ) : null}

      {canManageTestingOverride ? (
        <label className="flex max-w-xl cursor-pointer items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={testingOverrideEnabled}
            disabled={busy}
            onChange={(e) => void onToggleTestingOverride(e.target.checked)}
          />
          <span>
            <span className="font-semibold text-brand-black">Worksheet testing override</span>
            <span className="mt-1 block text-brand-black/70">
              Temporary mode for spreadsheet trials: no GVRA auth numbers required, unreleased
              rosters hidden from supervisors, accounts, and field staff.
            </span>
          </span>
        </label>
      ) : testingOverrideEnabled ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Worksheet testing override is active (admin-managed).
        </p>
      ) : null}

      {testingOverrideEnabled && canManageTestingOverride ? (
        <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4">
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="font-medium text-brand-black">Test roster export</span>
              <input
                type="month"
                className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2"
                value={emailRosterMonth}
                onChange={(e) => {
                  setEmailRosterMonth(e.target.value);
                  setTestRosterList(null);
                }}
                disabled={rosterExportBusy}
              />
            </label>
            <button
              type="button"
              disabled={rosterExportBusy}
              className="rounded-lg border border-brand-green bg-white px-4 py-2 text-sm font-semibold text-brand-green disabled:opacity-50"
              onClick={() => void loadTestRosterList()}
            >
              List rosters
            </button>
            <button
              type="button"
              disabled={rosterExportBusy}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              onClick={() => void onDownloadAllPdfsSequentially()}
            >
              {rosterExportBusy ? "Working…" : "Download all PDFs (one at a time)"}
            </button>
            {rosterExportBusy ? (
              <button
                type="button"
                className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black/80"
                onClick={onCancelRosterExport}
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              disabled={rosterExportBusy}
              className="rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm text-brand-black/80 disabled:opacity-50"
              onClick={() => void onEmailTestRosters()}
            >
              {rosterExportBusy ? "Working…" : "Email all (ZIP)"}
            </button>
          </div>
          {rosterExportProgress ? (
            <p className="text-xs font-medium text-brand-black/75">{rosterExportProgress}</p>
          ) : null}
          <p className="text-xs text-brand-black/65">
            ZIP downloads are built on the server in parts of up to {PRE_ETS_TEST_ROSTER_ZIP_CHUNK_SIZE}{" "}
            PDFs so your browser does not run out of memory.{" "}
            Download all PDFs (one at a time) is the safest option for very large months. Email
            bundles everything in one request and often fails when there are many rosters. Pending
            auth numbers OK; students without a PID or marked NOT APPROVED are excluded. Email goes
            to bryan.evans@thejoshuatree.org.
          </p>
          {testRosterList && testRosterList.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Array.from(
                { length: preEtsTestRosterZipPartCount(testRosterList.length) },
                (_, index) => {
                  const part = index + 1;
                  const partCount = preEtsTestRosterZipPartCount(testRosterList.length);
                  return (
                    <a
                      key={part}
                      href={preEtsTestRosterZipDownloadUrl(emailRosterMonth, part)}
                      className="rounded-lg border border-brand-green bg-white px-3 py-1.5 text-xs font-semibold text-brand-green hover:bg-brand-green/5"
                    >
                      {partCount === 1
                        ? `Download ZIP (${testRosterList.length} PDFs)`
                        : `Download ZIP part ${part} of ${partCount}`}
                    </a>
                  );
                }
              )}
            </div>
          ) : null}
          {testRosterList && testRosterList.length > 0 ? (
            <ul className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-blue-100 bg-white p-3 text-xs">
              {testRosterList.map((row) => (
                <li key={row.authorizationId} className="flex flex-wrap items-center gap-2">
                  <span className="text-brand-black/80">
                    {row.fileLabel}{" "}
                    <span className="text-brand-black/50">({row.eligibleStudentCount} students)</span>
                  </span>
                  <a
                    className="font-semibold text-brand-green underline"
                    href={`/api/pre-ets/authorizations/${row.authorizationId}/roster-pdf`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    PDF
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
        <label className="cursor-pointer rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white">
          {busy ? "Uploading…" : "Upload CSV"}
          <input
            type="file"
            accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
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

      {parseIssues.length > 0 ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-brand-black">Spreadsheet flags</h3>
          <p className="mt-1 text-xs text-brand-black/70">
            These items need review — missing columns, skipped rows, or parse warnings. Fix the
            source file when possible and re-upload.
          </p>
          <ul className="mt-2 max-h-48 overflow-y-auto text-xs text-amber-950">
            {parseIssues.slice(0, 100).map((issue, i) => (
              <li key={`${issue}-${i}`}>{issue}</li>
            ))}
          </ul>
          {parseIssues.length > 100 ? (
            <p className="mt-2 text-xs text-brand-black/55">
              Showing first 100 of {parseIssues.length} flags.
            </p>
          ) : null}
        </div>
      ) : null}

      {schoolGroupLabels.length > 0 ? (
        <p className="text-sm text-brand-black/75">
          Groups in this upload: {schoolGroupLabels.join(", ")}
        </p>
      ) : null}

      {skippedEmptyGroups.length > 0 ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
          <h3 className="font-semibold text-brand-black">Groups skipped (no roster created)</h3>
          <p className="mt-1 text-xs text-brand-black/70">
            These schools/groups appeared in the spreadsheet but had no students with a PID (or only
            NOT APPROVED rows). Re-upload after fixing the source file, or add students manually.
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-red-950">
            {skippedEmptyGroups.map((g, i) => (
              <li key={`${g.headerRaw}-${i}`}>
                {g.schoolName} — {g.groupName}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {preview && !isSupervisorMode ? (
        <div className="rounded-xl border border-brand-green/30 bg-brand-green/5 p-4">
          <h3 className="font-semibold text-brand-black">Parse preview</h3>
          <p className="mt-1 text-sm text-brand-black/70">
            District {preview.parsed.districtNumber ?? "—"} · {preview.parsed.monthLabel}{" "}
            {preview.parsed.schoolYear}
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
                    <p>
                      {g.schoolName}
                      {g.groupDesignation ? ` · ${g.groupDesignation}` : ""}
                    </p>
                    <p className="text-brand-black/55">
                      {g.instructorName ?? "—"} · {g.frequency ?? "—"} · {g.students.length} students
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
            onClick={() => void worksheetAction(preview.importId, "approve")}
          >
            Approve worksheet
          </button>
        </div>
      ) : null}

      {schoolNameWarnings.length > 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <h3 className="font-semibold text-brand-black">School name matching</h3>
          <p className="mt-1 text-xs text-brand-black/70">
            Review these rows when class setup names differ from the worksheet header. Ambiguous
            matches need an accounts or supervisor decision in Class setup.
          </p>
          <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-amber-950">
            {schoolNameWarnings.map((w) => (
              <li key={`${w.worksheetSchoolName}-${w.resolvedSchoolName}`}>
                Worksheet: {w.worksheetSchoolName}
                {w.resolvedSchoolName !== w.worksheetSchoolName
                  ? ` → matched ${w.resolvedSchoolName} (${w.source})`
                  : ""}
                {w.ambiguousCandidates?.length
                  ? ` — unclear: ${w.ambiguousCandidates.join(", ")}`
                  : ""}
              </li>
            ))}
          </ul>
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
            <div>
              <dt className="text-brand-black/55">School assignments updated (spreadsheet)</dt>
              <dd className="font-semibold">{authMatchStats.instructorSchoolsAssigned ?? 0}</dd>
            </div>
            <div>
              <dt className="text-brand-black/55">Instructor names ignored (no profile)</dt>
              <dd className="font-semibold">{authMatchStats.instructorNamesIgnored ?? 0}</dd>
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
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {imports.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-brand-black/55">
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
                  <td className="px-3 py-2 text-xs">
                    {!isSupervisorMode && row.status === "parsed" ? (
                      <button
                        type="button"
                        className="text-brand-green hover:underline"
                        onClick={() => void worksheetAction(row.id, "approve")}
                      >
                        Approve
                      </button>
                    ) : null}
                    {!isSupervisorMode && row.status === "approved" ? (
                      <button
                        type="button"
                        className="text-brand-green hover:underline"
                        onClick={() => void worksheetAction(row.id, "commit")}
                      >
                        Commit
                      </button>
                    ) : null}
                    {row.status === "committed" ? (
                      <button
                        type="button"
                        className="text-brand-green hover:underline"
                        disabled={busy}
                        title="Re-parse the saved upload and rebuild this district month's rosters (no new file needed)"
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Re-parse the stored worksheet and rebuild rosters for this district and billing month? Existing program groups and authorizations for that month will be replaced."
                            )
                          ) {
                            return;
                          }
                          void worksheetAction(row.id, "reprocess");
                        }}
                      >
                        Re-parse stored file
                      </button>
                    ) : null}
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
