"use client";

import { easternTodayYmd } from "@/lib/contact-log-daily-copy";
import { friendlyClientError, USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { useState } from "react";

type Props = {
  clientId: string;
};

export function ContactLogDailyCopy({ clientId }: Props) {
  const [date, setDate] = useState(easternTodayYmd());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyDay() {
    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const res = await fetch(
        `/api/exports/contact-logs-daily?client=${encodeURIComponent(clientId)}&date=${encodeURIComponent(date)}`
      );
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? USER_FACING_SYSTEM_ERROR);
      }
      const text = data.text ?? "";
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      setError(friendlyClientError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50/80 p-4">
      <h3 className="text-sm font-semibold text-brand-black">Copy for Vocational Progress Report</h3>
      <p className="mt-1 text-xs text-brand-black/60">
        Plain text for one day: date, start time (Eastern), and contact notes only — no activity type
        or internal notes.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm font-medium text-brand-black">
          Day
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={busy}
          />
        </label>
        <button
          type="button"
          onClick={() => void copyDay()}
          disabled={busy}
          className="rounded-lg border border-brand-green bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
        >
          {busy ? "Copying…" : "Copy day to clipboard"}
        </button>
        {copied ? <span className="text-sm text-brand-green">Copied.</span> : null}
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
