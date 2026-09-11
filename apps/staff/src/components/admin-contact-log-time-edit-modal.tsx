"use client";

import { DEFAULT_ACTIVITY_CODES } from "@wayfinder/supabase/es-time-tracking";
import type { ServiceActivityType } from "@wayfinder/supabase/es-time-tracking";
import { useEffect, useState } from "react";
import { TimeActivityFields } from "@/components/time-activity-fields";
import type { ContactLogTimeEntrySnapshot } from "@/lib/admin-contact-log-time";

type Props = {
  contactLogId: string;
  clientLabel: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

type LoadResponse = {
  summary?: string;
  timeEntry?: ContactLogTimeEntrySnapshot | null;
  activities?: ServiceActivityType[];
  error?: string;
};

export function AdminContactLogTimeEditModal({
  contactLogId,
  clientLabel,
  onClose,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [activities, setActivities] = useState<ServiceActivityType[]>([]);
  const [timeEntryId, setTimeEntryId] = useState<string | null>(null);
  const [activityTypeId, setActivityTypeId] = useState("");
  const [serviceDate, setServiceDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/portal/logs/contact-time?contactLogId=${encodeURIComponent(contactLogId)}`
        );
        const data = (await res.json()) as LoadResponse;
        if (!res.ok) {
          throw new Error(data.error || "Could not load contact log time");
        }
        if (cancelled) return;

        setSummary(data.summary ?? "Contact log");
        setActivities(data.activities ?? []);
        const entry = data.timeEntry ?? null;
        if (!entry) {
          setTimeEntryId(null);
          return;
        }

        setTimeEntryId(entry.id);
        setActivityTypeId(entry.activityTypeId);
        setServiceDate(entry.serviceDate);
        setDurationMinutes(entry.durationMinutes);
        setStartTime(entry.startTime);
        setEndTime(entry.endTime);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load contact log time");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [contactLogId]);

  async function save() {
    if (!timeEntryId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/logs/contact-time", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactLogId,
          timeEntryId,
          activityTypeId,
          serviceDate,
          durationMinutes,
          startTime: startTime || undefined,
          endTime: endTime || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || "Save failed");
      }
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-xl"
        role="dialog"
        aria-labelledby="admin-contact-log-time-title"
      >
        <h2 id="admin-contact-log-time-title" className="text-lg font-semibold text-brand-black">
          Correct service time
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">
          {clientLabel} · {summary}
        </p>

        {loading ? (
          <p className="mt-6 text-sm text-brand-black/60">Loading…</p>
        ) : !timeEntryId ? (
          <p className="mt-6 text-sm text-brand-black/75">
            This contact log has no linked service time entry to edit.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            <TimeActivityFields
              activities={activities}
              defaultCode={DEFAULT_ACTIVITY_CODES.contact}
              activityTypeId={activityTypeId}
              onActivityTypeIdChange={setActivityTypeId}
              durationMinutes={durationMinutes}
              onDurationMinutesChange={setDurationMinutes}
              serviceDate={serviceDate}
              onServiceDateChange={setServiceDate}
              showServiceDate
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              disabled={saving}
            />
            <p className="text-xs text-brand-black/60">
              Changes update the billable time entry linked to this contact log and are recorded in
              the audit change log.
            </p>
          </div>
        )}

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
          {timeEntryId ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !activityTypeId || !serviceDate}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save time"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
