"use client";

import { useState, useTransition } from "react";

type Props = {
  clientId: string;
  episodeId: string;
  defaultEsName: string;
  defaultCounselorName: string;
  serviceName: string;
  clientName: string;
};

function previousMonthRange(): { from: string; to: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { from: fmt(first), to: fmt(last) };
}

export function VocationalServiceRenderedExportPanel({
  clientId,
  episodeId,
  defaultEsName,
  defaultCounselorName,
  serviceName,
  clientName,
}: Props) {
  const defaults = previousMonthRange();
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [esName, setEsName] = useState(defaultEsName);
  const [counselorName, setCounselorName] = useState(defaultCounselorName);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function download(format: "pdf" | "csv") {
    setError(null);
    startTransition(async () => {
      const params = new URLSearchParams({
        clientId,
        episodeId,
        from,
        to,
        esName,
        counselorName,
        format,
      });
      const res = await fetch(`/api/exports/vocational-service-rendered?${params.toString()}`);
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Could not generate report.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `vocational-service-rendered.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <h3 className="text-base font-semibold text-brand-green">Vocational Service Rendered</h3>
      <p className="mt-1 text-sm text-brand-black/70">
        {serviceName} · {clientName}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="font-medium text-brand-black/80">From</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-brand-black/80">To</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-brand-black/80">Employment Specialist</span>
          <input
            type="text"
            value={esName}
            onChange={(e) => setEsName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="font-medium text-brand-black/80">Counselor</span>
          <input
            type="text"
            value={counselorName}
            onChange={(e) => setCounselorName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
          />
        </label>
      </div>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => download("pdf")}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          Download PDF
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => download("csv")}
          className="rounded-lg border border-brand-green px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}
