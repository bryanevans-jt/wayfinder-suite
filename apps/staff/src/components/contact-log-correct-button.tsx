"use client";

import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Props = {
  logId: string;
  clientId: string;
  initialPublicOutcome: string;
  initialNotes: string;
};

export function ContactLogCorrectButton({
  logId,
  clientId,
  initialPublicOutcome,
  initialNotes,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [publicOutcome, setPublicOutcome] = useState(initialPublicOutcome);
  const [notes, setNotes] = useState(initialNotes);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    if (!publicOutcome.trim()) {
      setError("Notes are required.");
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch("/api/es/contact-log", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: logId,
            clientId,
            contactNotes: publicOutcome.trim(),
            internalNotes: notes.trim(),
          }),
        });
        const data = (await res.json()) as { error?: string; ok?: boolean };
        if (!res.ok) throw new Error(data.error ?? "Could not save correction.");
        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(friendlyClientError(err));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 text-xs font-semibold text-brand-green hover:underline"
      >
        Correct (within 24 hours)
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
      <p className="text-xs text-brand-black/70">
        Edit your notes only. Linked timesheet entries are not changed. Counselors may already
        have seen the original Notes.
      </p>
      <label className="block text-xs font-medium text-brand-black">
        Notes (counselor-visible)
        <textarea
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          rows={3}
          value={publicOutcome}
          onChange={(e) => setPublicOutcome(e.target.value)}
        />
      </label>
      <label className="block text-xs font-medium text-brand-black">
        Internal notes
        <textarea
          className="mt-1 w-full rounded border border-neutral-300 bg-white px-2 py-1.5 text-sm"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>
      {error ? <p className="text-xs text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg bg-brand-green px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save correction"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setOpen(false);
            setPublicOutcome(initialPublicOutcome);
            setNotes(initialNotes);
            setError(null);
          }}
          className="rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
