"use client";

import { DEFAULT_ACTIVITY_CODES, todayLocalDate } from "@wayfinder/supabase/es-time-tracking";
import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { TimeActivityFields, useTimeActivityDefaults } from "@/components/time-activity-fields";
import { addManualClientTime } from "./actions";

type Props = {
  clientId: string;
  activities: ServiceActivityType[];
  readOnly?: boolean;
};

export function ClientManualTimeForm({ clientId, activities, readOnly = false }: Props) {
  const router = useRouter();
  const defaults = useTimeActivityDefaults(activities, DEFAULT_ACTIVITY_CODES.manual);
  const [activityTypeId, setActivityTypeId] = useState(defaults.activityTypeId);
  const [durationMinutes, setDurationMinutes] = useState(defaults.durationMinutes);
  const [serviceDate, setServiceDate] = useState(todayLocalDate());
  const [narrative, setNarrative] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (readOnly) {
    return null;
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await addManualClientTime(
          clientId,
          activityTypeId,
          durationMinutes,
          serviceDate,
          narrative
        );
        setNarrative("");
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Add time (manual)
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        For work not captured by another form. Entries more than 7 days old are flagged for
        supervisor review.
      </p>
      <div className="mt-3 space-y-3">
        <TimeActivityFields
          activities={activities.filter((a) => a.requires_client)}
          defaultCode={DEFAULT_ACTIVITY_CODES.manual}
          activityTypeId={activityTypeId}
          onActivityTypeIdChange={setActivityTypeId}
          durationMinutes={durationMinutes}
          onDurationMinutesChange={setDurationMinutes}
          serviceDate={serviceDate}
          onServiceDateChange={setServiceDate}
          showServiceDate
          disabled={pending}
        />
        <label className="block text-sm font-medium text-brand-black">
          Service narrative
          <textarea
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
            rows={3}
            placeholder="Describe the service provided"
            className="mt-1 w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black outline-none ring-brand-green focus:ring-2"
            disabled={pending}
          />
        </label>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded-lg border border-brand-green bg-white px-4 py-2 text-sm font-semibold text-brand-green hover:bg-brand-green/5 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Add time entry"}
        </button>
      </div>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
