"use client";

import {
  CONTACT_LOG_INTERNAL_NOTES_LABEL,
  CONTACT_LOG_NOTES_LABEL,
} from "@wayfinder/branding/constants";
import { DEFAULT_ACTIVITY_CODES } from "@wayfinder/supabase/es-time-tracking";
import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import type { ActionResult } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { TimeActivityFields, useTimeActivityDefaults } from "@/components/time-activity-fields";

type Props = {
  clientId: string;
  activities: ServiceActivityType[];
};

export function ClientContactLogForm({ clientId, activities }: Props) {
  const router = useRouter();
  const defaults = useTimeActivityDefaults(activities, DEFAULT_ACTIVITY_CODES.contact);
  const [contactNotes, setContactNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [activityTypeId, setActivityTypeId] = useState(defaults.activityTypeId);
  const [durationMinutes, setDurationMinutes] = useState(defaults.durationMinutes);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const match =
      activities.find((a) => a.id === activityTypeId) ??
      activities.find((a) => a.code === DEFAULT_ACTIVITY_CODES.contact) ??
      activities[0];
    if (!match) {
      return;
    }
    if (activityTypeId !== match.id) {
      setActivityTypeId(match.id);
      setDurationMinutes(match.default_minutes);
    }
  }, [activities, activityTypeId]);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/es/contact-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            contactNotes,
            internalNotes,
            time:
              activityTypeId && durationMinutes > 0
                ? { activityTypeId, durationMinutes }
                : undefined,
          }),
        });

        const result = (await res.json()) as ActionResult;
        if (!res.ok || !result.ok) {
          setError(
            !result.ok && result.error
              ? result.error
              : "We could not save this contact log. Please try again."
          );
          return;
        }

        if (result.warning) {
          setNotice(result.warning);
        }
        setContactNotes("");
        setInternalNotes("");
        try {
          router.refresh();
        } catch {
          // Save succeeded even if refresh fails.
        }
      } catch {
        setError("We could not save this contact log. Please try again.");
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Log contact
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Choose an activity type and describe what happened in {CONTACT_LOG_NOTES_LABEL.toLowerCase()}.
        Counselors see those notes on the timeline. Billable time is optional — clear the activity
        field to skip time entry.
      </p>
      <div className="mt-3 space-y-3">
        <label className="block text-sm font-medium text-brand-black">
          {CONTACT_LOG_NOTES_LABEL}
          <textarea
            value={contactNotes}
            onChange={(e) => setContactNotes(e.target.value)}
            rows={3}
            placeholder="What happened? Include follow-up plans, who you spoke with, and next steps."
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black">
          {CONTACT_LOG_INTERNAL_NOTES_LABEL}
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={2}
            placeholder="Staff-only context (not shown to counselors or clients)"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={pending}
          />
        </label>
        <TimeActivityFields
          activities={activities}
          defaultCode={DEFAULT_ACTIVITY_CODES.contact}
          activityTypeId={activityTypeId}
          onActivityTypeIdChange={setActivityTypeId}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          activityTypeLabel="Activity type"
          disabled={pending}
        />
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
