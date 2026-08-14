"use client";

import { easternTodayYmd } from "@/lib/contact-log-daily-copy";
import { VPR_SERVICE_STAGE_OPTIONS, matchVprStageFromTitle } from "@/lib/vpr-stages";
import {
  friendlyClientError,
  parseApiErrorResponse,
  reportBrowserSystemError,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { useMemo, useState } from "react";

type Props = {
  clientId: string;
  clientName: string;
  currentStageTitle?: string | null;
  esName?: string | null;
  canSubmit?: boolean;
};

export function ContactLogDailyCopy({
  clientId,
  clientName,
  currentStageTitle = "",
  esName = "",
  canSubmit = true,
}: Props) {
  const defaultStage = useMemo(
    () => matchVprStageFromTitle(currentStageTitle),
    [currentStageTitle]
  );
  const [date, setDate] = useState(easternTodayYmd());
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [driveUrl, setDriveUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [serviceStage, setServiceStage] = useState(defaultStage);
  const [specialistName, setSpecialistName] = useState(esName.trim());

  async function compileDay() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setDriveUrl(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/exports/contact-logs-daily?client=${encodeURIComponent(clientId)}&date=${encodeURIComponent(date)}`
      );
      if (!res.ok) {
        const parsed = await parseApiErrorResponse(res);
        const shouldReport =
          !parsed.errorCode &&
          (res.status >= 500 ||
            res.status === 413 ||
            parsed.message.startsWith(USER_FACING_SYSTEM_ERROR));
        if (shouldReport) {
          const reported = await reportBrowserSystemError({
            app: "staff",
            route: "contact-log-daily-copy",
            message: `Compile day for VPR failed with HTTP ${res.status}: ${parsed.message}`,
          });
          setError(reported.message);
          return;
        }
        setError(friendlyClientError(parsed.message, parsed.errorCode));
        return;
      }

      const data = (await res.json()) as { text?: string; error?: string };
      setNotes(data.text ?? "");
      setServiceStage((prev) => prev || defaultStage);
      if (!specialistName.trim() && esName.trim()) {
        setSpecialistName(esName.trim());
      }
      setOpen(true);
    } catch (err) {
      const reported = await reportBrowserSystemError({
        app: "staff",
        route: "contact-log-daily-copy",
        message: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack ?? null : null,
      });
      setError(reported.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyNotes() {
    setError(null);
    try {
      await navigator.clipboard.writeText(notes);
      setCopied(true);
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  async function submitReport() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setDriveUrl(null);
    try {
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/vpr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          notes,
          serviceStage,
          esName: specialistName.trim(),
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        message?: string;
        driveUrl?: string | null;
      };
      if (!res.ok) {
        throw new Error(data.error || USER_FACING_SYSTEM_ERROR);
      }
      setSuccess(data.message ?? "Report submitted successfully.");
      setDriveUrl(data.driveUrl ?? null);
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <h3 className="text-sm font-semibold text-brand-black">Vocational Progress Report</h3>
      <p className="mt-1 text-xs text-brand-black/60">
        Compile this day’s contact notes, edit them, then file a Vocational Progress Report to the
        same Google Drive folder used in Joshua Tree Reports.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-brand-black">
          Day
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={busy || submitting}
          />
        </label>
        <button
          type="button"
          onClick={() => void compileDay()}
          disabled={busy || submitting}
          className="rounded-lg border border-brand-green bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
        >
          {busy ? "Compiling…" : "Compile for Progress Report"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <p className="text-sm">
              <span className="font-medium text-brand-black/70">Date</span>
              <span className="mt-0.5 block text-brand-black">{date}</span>
            </p>
            <p className="text-sm">
              <span className="font-medium text-brand-black/70">Client</span>
              <span className="mt-0.5 block text-brand-black">{clientName}</span>
            </p>
          </div>
          <label className="block text-sm font-medium text-brand-black">
            Service stage
            <select
              value={serviceStage}
              onChange={(e) => setServiceStage(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={submitting}
              required
            >
              <option value="">Select a stage…</option>
              {VPR_SERVICE_STAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-brand-black">
            Employment Specialist
            <input
              type="text"
              value={specialistName}
              onChange={(e) => setSpecialistName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={submitting}
            />
          </label>
          <label className="block text-sm font-medium text-brand-black">
            Notes
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              disabled={submitting}
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit ? (
              <button
                type="button"
                onClick={() => void submitReport()}
                disabled={submitting || !notes.trim() || !serviceStage || !specialistName.trim()}
                className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit Progress Report"}
              </button>
            ) : (
              <p className="text-sm text-amber-800">
                Exit preview to file a Vocational Progress Report.
              </p>
            )}
            <button
              type="button"
              onClick={() => void copyNotes()}
              disabled={!notes}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-60"
            >
              Copy to clipboard
            </button>
            {copied ? <span className="text-sm text-brand-green">Copied.</span> : null}
          </div>
        </div>
      ) : null}

      {success ? (
        <p className="mt-2 text-sm text-brand-green">
          {success}
          {driveUrl ? (
            <>
              {" "}
              <a href={driveUrl} target="_blank" rel="noreferrer" className="underline">
                Open in Drive
              </a>
            </>
          ) : null}
        </p>
      ) : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
