"use client";

import type { ActionResult } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setClientJobStartDate } from "./actions";

type Props = {
  clientId: string;
  initialJobStartDate: string | null;
  readOnly?: boolean;
};

export function ClientJobStartDateForm({
  clientId,
  initialJobStartDate,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [date, setDate] = useState(initialJobStartDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return initialJobStartDate ? (
      <p className="text-sm text-brand-black/80">
        Job start date: <strong>{initialJobStartDate}</strong>
      </p>
    ) : null;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const result: ActionResult = await setClientJobStartDate(clientId, date);
      if (!result.ok) {
        setError(result.error ?? "Could not save job start date.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-brand-green/25 bg-brand-green/5 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Employment start date
      </h2>
      <p className="mt-1 text-xs text-brand-black/65">
        Set when the client actually started work. This drives hire and 30/60/90-day celebrations for
        the client, counselor, natural supports, and your supervisors.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="font-medium text-brand-black">Job start date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={pending || !date}
          onClick={save}
          className="rounded-lg bg-brand-gold px-4 py-2 text-sm font-semibold text-white hover:bg-brand-gold/90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save & celebrate hire"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
