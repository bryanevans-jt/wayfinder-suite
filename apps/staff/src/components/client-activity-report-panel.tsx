"use client";

import { useCallback, useState, useTransition } from "react";

type Props = {
  clientId: string;
  clientName: string;
  defaultFrom: string;
  defaultTo: string;
};

export function ClientActivityReportPanel({
  clientId,
  clientName,
  defaultFrom,
  defaultTo,
}: Props) {
  const [dateFrom, setDateFrom] = useState(defaultFrom);
  const [dateTo, setDateTo] = useState(defaultTo);
  const [reportText, setReportText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = useCallback(() => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          client: clientId,
          from: dateFrom,
          to: dateTo,
          format: "text",
        });
        const res = await fetch(`/api/exports/client-activity-report?${params.toString()}`);
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(body?.error ?? "Could not generate report");
        }
        const text = await res.text();
        setReportText(text);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate report");
        setReportText(null);
      }
    });
  }, [clientId, dateFrom, dateTo]);

  async function copyReport() {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select the text below and copy manually.");
    }
  }

  const csvHref = `/api/exports/client-activity-report?client=${encodeURIComponent(clientId)}&from=${encodeURIComponent(dateFrom)}&to=${encodeURIComponent(dateTo)}&format=csv`;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Monthly activity report
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Generate a copy-friendly summary for {clientName} to paste into official monthly reports
        (VR agency forms, etc.). Includes contacts, applications, stage updates, and meetings.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-brand-black">
          From
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black">
          To
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={generate}
          disabled={pending || !dateFrom || !dateTo}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate report"}
        </button>
        {reportText ? (
          <button
            type="button"
            onClick={copyReport}
            className="rounded-lg border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5"
          >
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        ) : null}
        <a
          href={csvHref}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50"
        >
          Download CSV
        </a>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      {reportText ? (
        <textarea
          readOnly
          value={reportText}
          rows={16}
          className="mt-4 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs leading-relaxed text-brand-black"
          onFocus={(e) => e.target.select()}
        />
      ) : null}
    </div>
  );
}
