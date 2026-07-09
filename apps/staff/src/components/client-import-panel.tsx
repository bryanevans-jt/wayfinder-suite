"use client";

import {
  CLIENT_IMPORT_COLUMNS,
  analyzeClientImportCsv,
  parseClientImportCsv,
  type ClientImportInputRow,
  type ClientImportPreview,
} from "@wayfinder/supabase/client-import-csv";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useCallback, useState } from "react";

const BATCH_SIZE = 25;

type ImportReference = {
  offices: string[];
  services: string[];
  counselors: string[];
  esEmails: string[];
};

type ClientImportRowResult = {
  row: number;
  email: string;
  client_name: string;
  ok: boolean;
  skipped?: boolean;
  error?: string;
};

type Props = {
  disabled?: boolean;
  onComplete?: () => void;
};

export function ClientImportPanel({ disabled = false, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState<ImportReference | null>(null);
  const [parsedRows, setParsedRows] = useState<ClientImportInputRow[]>([]);
  const [preview, setPreview] = useState<ClientImportPreview | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<ClientImportRowResult[]>([]);
  const [summary, setSummary] = useState<{ imported: number; skipped: number; failed: number } | null>(null);

  const loadTemplate = useCallback(async () => {
    const res = await fetch("/api/portal/clients/import");
    const data = (await res.json()) as {
      csv?: string;
      reference?: ImportReference;
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
    }
    if (data.reference) {
      setReference(data.reference);
    }
    if (!data.csv) {
      throw new Error("Template unavailable");
    }
    const blob = new Blob([data.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wayfinder-client-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  function resetImportState() {
    setParsedRows([]);
    setPreview(null);
    setParseError(null);
    setProgress(null);
    setResults([]);
    setSummary(null);
  }

  async function handleFile(file: File) {
    resetImportState();
    try {
      const text = await file.text();
      const rows = parseClientImportCsv(text);
      if (rows.length === 0) {
        setParseError("The file has no data rows. Add clients below the header row.");
        return;
      }
      setParsedRows(rows);
      setPreview(analyzeClientImportCsv(rows));
      if (!reference) {
        const res = await fetch("/api/portal/clients/import");
        const data = (await res.json()) as { reference?: ImportReference };
        if (data.reference) {
          setReference(data.reference);
        }
      }
    } catch (e) {
      setParseError(friendlyClientError(e));
    }
  }

  async function runImport() {
    if (parsedRows.length === 0) {
      return;
    }
    setBusy(true);
    setResults([]);
    setSummary(null);
    setProgress({ done: 0, total: parsedRows.length });

    const allResults: ClientImportRowResult[] = [];
    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (let offset = 0; offset < parsedRows.length; offset += BATCH_SIZE) {
        const chunk = parsedRows.slice(offset, offset + BATCH_SIZE);
        const startRow = offset + 2;
        const res = await fetch("/api/portal/clients/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: chunk, startRow }),
        });
        const data = (await res.json()) as {
          imported?: number;
          skipped?: number;
          failed?: number;
          results?: ClientImportRowResult[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
        }
        imported += data.imported ?? 0;
        skipped += data.skipped ?? 0;
        failed += data.failed ?? 0;
        allResults.push(...(data.results ?? []));
        setProgress({ done: Math.min(offset + chunk.length, parsedRows.length), total: parsedRows.length });
        setResults([...allResults]);
      }
      setSummary({ imported, skipped, failed });
      onComplete?.();
    } catch (e) {
      setParseError(friendlyClientError(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-brand-black">Import clients from a spreadsheet</span>
          <span className="mt-0.5 block text-xs text-brand-black/60">
            Add many clients at once using our template file. New accounts are created without an
            email invitation unless you choose to send one.
          </span>
        </span>
        <span className="text-sm font-medium text-brand-green">{open ? "Hide" : "Show"}</span>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-neutral-100 px-4 pb-4 pt-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-brand-black/75">
            <li>Download the template and fill in one row per client.</li>
            <li>
              Required columns:{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs">
                client_name, office, service, counselor
              </code>
            </li>
            <li>
              Optional: <code className="rounded bg-neutral-100 px-1 text-xs">email</code>{" "}
              (blank = no client login),{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs">es_email</code>,{" "}
              <code className="rounded bg-neutral-100 px-1 text-xs">send_invite</code> (yes/no)
            </li>
            <li>Upload the completed CSV and run import.</li>
          </ol>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void loadTemplate().catch((e) => setParseError(friendlyClientError(e)))}
              className="rounded-lg border border-brand-green/40 bg-brand-green/10 px-3 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/15 disabled:opacity-60"
            >
              Download template
            </button>
            <label className="cursor-pointer rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-white hover:bg-brand-gold/90 has-[:disabled]:opacity-60">
              Choose CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                disabled={disabled || busy}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    void handleFile(file);
                  }
                  e.target.value = "";
                }}
              />
            </label>
            {parsedRows.length > 0 ? (
              <button
                type="button"
                disabled={disabled || busy}
                onClick={() => void runImport()}
                className="rounded-lg bg-brand-green px-3 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
              >
                {busy ? "Importing…" : `Import ${parsedRows.length} client${parsedRows.length === 1 ? "" : "s"}`}
              </button>
            ) : null}
          </div>

          {reference ? (
            <details className="rounded-lg border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-xs text-brand-black/70">
              <summary className="cursor-pointer font-semibold text-brand-black">
                Valid values in your database
              </summary>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="font-medium text-brand-black">Offices</p>
                  <p>{reference.offices.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-brand-black">Services</p>
                  <p>{reference.services.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-brand-black">Counselors</p>
                  <p>{reference.counselors.join(", ") || "—"}</p>
                </div>
                <div>
                  <p className="font-medium text-brand-black">ES emails</p>
                  <p>{reference.esEmails.join(", ") || "—"}</p>
                </div>
              </div>
            </details>
          ) : null}

          {progress ? (
            <p className="text-sm text-brand-black/70">
              Processing {progress.done} of {progress.total}…
            </p>
          ) : null}

          {parseError ? <p className="text-sm text-red-700">{parseError}</p> : null}

          {parsedRows.length > 0 && !summary && preview ? (
            <div className="space-y-3 rounded-lg border border-neutral-200 bg-neutral-50/80 p-3 text-sm text-brand-black/80">
              <p>
                <strong>{preview.rowCount}</strong> row{preview.rowCount === 1 ? "" : "s"} found —{" "}
                <strong>{preview.readyCount}</strong> ready to import
                {preview.issues.length > 0
                  ? `, ${preview.issues.length} row${preview.issues.length === 1 ? "" : "s"} need fixes`
                  : ""}
                .
              </p>
              {preview.duplicateEmails.length > 0 ? (
                <p className="text-amber-900">
                  Duplicate emails in file: {preview.duplicateEmails.join(", ")}
                </p>
              ) : null}
              {preview.issues.length > 0 ? (
                <div className="max-h-40 overflow-auto rounded border border-neutral-200 bg-white">
                  <table className="min-w-full text-left text-xs">
                    <thead className="sticky top-0 bg-neutral-50">
                      <tr>
                        <th className="px-2 py-1.5">Row</th>
                        <th className="px-2 py-1.5">Client</th>
                        <th className="px-2 py-1.5">Problems</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.issues.map((issue) => (
                        <tr key={issue.row} className="border-t border-neutral-100">
                          <td className="px-2 py-1.5">{issue.row}</td>
                          <td className="px-2 py-1.5">{issue.clientName}</td>
                          <td className="px-2 py-1.5 text-red-700">{issue.issues.join("; ")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          ) : null}

          {parsedRows.length > 0 && !summary ? (
            <p className="text-sm text-brand-black/70">
              Fix any problems above, then run import. Rows with problems may still fail during
              import.
            </p>
          ) : null}

          {summary ? (
            <p className="text-sm font-medium text-brand-black">
              Done: {summary.imported} imported, {summary.skipped} already existed, {summary.failed}{" "}
              failed.
            </p>
          ) : null}

          {results.length > 0 ? (
            <div className="max-h-64 overflow-auto rounded-lg border border-neutral-200">
              <table className="min-w-full text-left text-xs">
                <thead className="sticky top-0 bg-neutral-50">
                  <tr>
                    <th className="px-2 py-1.5">Row</th>
                    <th className="px-2 py-1.5">Client</th>
                    <th className="px-2 py-1.5">Email</th>
                    <th className="px-2 py-1.5">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={`${r.row}-${r.email}`} className="border-t border-neutral-100">
                      <td className="px-2 py-1.5">{r.row}</td>
                      <td className="px-2 py-1.5">{r.client_name}</td>
                      <td className="px-2 py-1.5">{r.email}</td>
                      <td className="px-2 py-1.5">
                        {r.ok ? (
                          r.skipped ? (
                            <span className="text-brand-black/70">Already exists</span>
                          ) : (
                            <span className="text-brand-green">Imported</span>
                          )
                        ) : (
                          <span className="text-red-700">{r.error ?? "Failed"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
