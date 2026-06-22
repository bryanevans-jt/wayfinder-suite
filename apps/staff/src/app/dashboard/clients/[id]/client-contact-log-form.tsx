"use client";

import { DEFAULT_ACTIVITY_CODES } from "@wayfinder/supabase/es-time-tracking";
import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TimeActivityFields, useTimeActivityDefaults } from "@/components/time-activity-fields";
import { addClientContactLog } from "./actions";

type Props = {
  clientId: string;
  activities: ServiceActivityType[];
};

export function ClientContactLogForm({ clientId, activities }: Props) {
  const router = useRouter();
  const defaults = useTimeActivityDefaults(activities, DEFAULT_ACTIVITY_CODES.contact);
  const [publicOutcome, setPublicOutcome] = useState("");
  const [notes, setNotes] = useState("");
  const [activityTypeId, setActivityTypeId] = useState(defaults.activityTypeId);
  const [durationMinutes, setDurationMinutes] = useState(defaults.durationMinutes);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await addClientContactLog(
        clientId,
        publicOutcome,
        notes,
        activityTypeId && durationMinutes > 0
          ? { activityTypeId, durationMinutes }
          : undefined
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.warning) {
        setNotice(result.warning);
      }
      setPublicOutcome("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Log contact
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Counselors see the public outcome and notes on the client timeline. Billable time is optional
        — leave activity blank to skip time entry.
      </p>
      <div className="mt-3 space-y-3">
        <TimeActivityFields
          activities={activities}
          defaultCode={DEFAULT_ACTIVITY_CODES.contact}
          activityTypeId={activityTypeId}
          onActivityTypeIdChange={setActivityTypeId}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          disabled={pending}
        />
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
      {notice ? <p className="mt-2 text-sm text-amber-800">{notice}</p> : null}
    </div>
  );
}
