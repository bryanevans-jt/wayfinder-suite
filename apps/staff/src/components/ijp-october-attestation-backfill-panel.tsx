"use client";

import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useState } from "react";

type DryRunPreview = {
  dryRun: true;
  targetRelativePath: string;
  targetServiceMonth: string;
  attestationRootConfigured: boolean;
  counts: {
    sourceWithDrive: number;
    wouldCopy: number;
    alreadyLinkedOctober: number;
    skippedMissingDrive: number;
  };
  clientIdsToCopy: string[];
  alreadyLinkedClientIds: string[];
  candidates?: Array<{
    clientId: string;
    sourceServiceMonth: string;
    capturedAt: string | null;
  }>;
};

type ExecuteResult = {
  dryRun: false;
  copied: number;
  skipped: Array<{ clientId: string; reason: string }>;
  failed: Array<{ clientId: string; reason: string }>;
  counts: { copied: number; skipped: number; failed: number };
  error?: string;
};

type Step = "idle" | "preview" | "confirm" | "done";

/** Super Admin-only one-time October attestation Drive copy control. */
export function IjpOctoberAttestationBackfillPanel() {
  const [step, setStep] = useState<Step>("idle");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<DryRunPreview | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<ExecuteResult | null>(null);

  async function loadPreview() {
    setBusy(true);
    setError(null);
    setResult(null);
    setConfirmed(false);
    const res = await fetch("/api/admin/ijp-october-attestation-backfill");
    const data = (await res.json()) as DryRunPreview & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      setStep("idle");
      return;
    }
    setPreview(data);
    setStep("preview");
  }

  async function runExecute() {
    if (!confirmed || !preview) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/ijp-october-attestation-backfill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ execute: true, confirmExecute: true }),
    });
    const data = (await res.json()) as ExecuteResult & { error?: string };
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? USER_FACING_SYSTEM_ERROR);
      return;
    }
    setResult(data);
    setStep("done");
  }

  return (
    <section className="rounded-xl border border-dashed border-slate-400 bg-slate-50/60 p-4">
      <h2 className="text-lg font-semibold text-brand-black">
        Copy Oct/Nov signatures to October 2026
      </h2>
      <p className="mt-1 text-sm text-brand-black/70">
        Super Admin only. Dry-run first, then confirm, then Run. Copies Drive PDFs into
        attestation root <code className="text-xs">{preview?.targetRelativePath ?? "2026/2026-10"}</code>{" "}
        and links October <code className="text-xs">ijp_monthly_attestations</code> rows. Skips
        clients already linked for October. Never changes November rows or files. Empty October
        invoices are left untouched.
      </p>

      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
          onClick={() => void loadPreview()}
        >
          {step === "idle" ? "Preview dry-run" : "Refresh dry-run"}
        </button>
        {step === "preview" || step === "confirm" ? (
          <button
            type="button"
            disabled={busy}
            className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm disabled:opacity-50"
            onClick={() => setStep("confirm")}
          >
            Continue to confirm
          </button>
        ) : null}
      </div>

      {preview && (step === "preview" || step === "confirm" || step === "done") ? (
        <div className="mt-4 space-y-3 text-sm">
          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
            <p className="font-semibold">Dry-run counts</p>
            <ul className="mt-1 list-inside list-disc text-brand-black/80">
              <li>sourceWithDrive: {preview.counts.sourceWithDrive}</li>
              <li>wouldCopy: {preview.counts.wouldCopy}</li>
              <li>alreadyLinkedOctober: {preview.counts.alreadyLinkedOctober}</li>
              <li>skippedMissingDrive: {preview.counts.skippedMissingDrive}</li>
              <li>
                attestation root configured:{" "}
                {preview.attestationRootConfigured ? "yes" : "no"}
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
            <p className="font-semibold">
              Client ids to copy ({preview.clientIdsToCopy.length})
            </p>
            {preview.clientIdsToCopy.length === 0 ? (
              <p className="mt-1 text-brand-black/60">None — nothing to copy.</p>
            ) : (
              <ul className="mt-1 max-h-48 overflow-y-auto font-mono text-xs text-brand-black/75">
                {preview.clientIdsToCopy.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            )}
          </div>

          {preview.alreadyLinkedClientIds.length > 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <p className="font-semibold">
                Already linked for October ({preview.alreadyLinkedClientIds.length})
              </p>
              <ul className="mt-1 max-h-32 overflow-y-auto font-mono text-xs text-brand-black/55">
                {preview.alreadyLinkedClientIds.map((id) => (
                  <li key={id}>{id}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {step === "confirm" ? (
        <div className="mt-4 space-y-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-950">
          <p className="font-semibold">Confirm execute</p>
          <p>
            This will copy up to {preview?.counts.wouldCopy ?? 0} Drive PDF(s) into{" "}
            {preview?.targetRelativePath} and create/link October 2026 attestation rows. Source
            November rows and files are not modified.
          </p>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I understand this writes production attestation rows and Drive copies for October
              2026.
            </span>
          </label>
          <button
            type="button"
            disabled={busy || !confirmed || (preview?.counts.wouldCopy ?? 0) === 0}
            className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            onClick={() => void runExecute()}
          >
            Run
          </button>
        </div>
      ) : null}

      {step === "done" && result ? (
        <div className="mt-4 space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
          <p className="font-semibold">Execute finished</p>
          <ul className="list-inside list-disc">
            <li>copied: {result.counts.copied}</li>
            <li>skipped: {result.counts.skipped}</li>
            <li>failed: {result.counts.failed}</li>
          </ul>
          {result.skipped.length > 0 ? (
            <div>
              <p className="font-medium">Skipped</p>
              <ul className="font-mono text-xs">
                {result.skipped.map((s) => (
                  <li key={`${s.clientId}-${s.reason}`}>
                    {s.clientId}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.failed.length > 0 ? (
            <div>
              <p className="font-medium text-red-800">Failed</p>
              <ul className="font-mono text-xs text-red-800">
                {result.failed.map((f) => (
                  <li key={`${f.clientId}-${f.reason}`}>
                    {f.clientId}: {f.reason}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="text-xs text-emerald-900/80">
            October invoice missing_attestation flags were recomputed for successfully copied
            clients.
          </p>
        </div>
      ) : null}
    </section>
  );
}
