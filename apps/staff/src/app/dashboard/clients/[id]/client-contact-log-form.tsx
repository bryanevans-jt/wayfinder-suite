"use client";

import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addClientContactLog } from "./actions";

type Props = {
  clientId: string;
};

export function ClientContactLogForm({ clientId }: Props) {
  const router = useRouter();
  const [publicOutcome, setPublicOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await addClientContactLog(clientId, publicOutcome, notes);
        setPublicOutcome("");
        setNotes("");
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Log contact
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Counselors see the public outcome and notes on the client timeline.
      </p>
      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium text-brand-black">
          Public outcome
          <input
            type="text"
            value={publicOutcome}
            onChange={(e) => setPublicOutcome(e.target.value)}
            placeholder="e.g. Left voicemail, scheduled follow-up"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Internal detail for the counselor timeline"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={pending}
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save contact log"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
