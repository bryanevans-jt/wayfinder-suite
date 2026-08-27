"use client";

import { formatPortalDateTime, PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

export type ClientIntakeAppointment = {
  id: string;
  startsAt: string;
  location: string;
  timezone: string;
};

type Props = {
  clientId: string;
  appointment: ClientIntakeAppointment;
  canWrite: boolean;
};

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ClientIntakeAppointmentPanel({ clientId, appointment, canWrite }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [startsLocal, setStartsLocal] = useState(toLocalInputValue(appointment.startsAt));
  const [location, setLocation] = useState(appointment.location);
  const [timezone, setTimezone] = useState(appointment.timezone || PORTAL_DISPLAY_TIME_ZONE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setStartsLocal(toLocalInputValue(appointment.startsAt));
    setLocation(appointment.location);
    setTimezone(appointment.timezone || PORTAL_DISPLAY_TIME_ZONE);
    setEditing(false);
    setSaved(false);
    setError(null);
  }, [appointment.startsAt, appointment.location, appointment.timezone, appointment.id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !editing) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const startsAt = new Date(startsLocal).toISOString();
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/intake-appointment`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: startsAt,
          location: location.trim(),
          timezone: timezone.trim() || PORTAL_DISPLAY_TIME_ZONE,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not save");
      setSaved(true);
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  function cancelEdit() {
    setStartsLocal(toLocalInputValue(appointment.startsAt));
    setLocation(appointment.location);
    setTimezone(appointment.timezone || PORTAL_DISPLAY_TIME_ZONE);
    setEditing(false);
    setError(null);
  }

  return (
    <form
      onSubmit={(e) => void onSave(e)}
      className="space-y-4 rounded-xl border border-neutral-200 bg-white p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-brand-black">Intake appointment</h3>
          <p className="mt-1 text-sm text-brand-black/65">
            Shown on the Activity Timeline. Rescheduling resets client reminder emails for the new
            time.
          </p>
        </div>
        {canWrite && !editing ? (
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              setSaved(false);
              setError(null);
            }}
            className="rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-semibold text-brand-black hover:bg-neutral-50"
          >
            Reschedule
          </button>
        ) : null}
      </div>

      {!editing ? (
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-brand-black/55">Date &amp; time</dt>
            <dd className="text-brand-black">
              {formatPortalDateTime(
                appointment.startsAt,
                appointment.timezone || PORTAL_DISPLAY_TIME_ZONE
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Location</dt>
            <dd className="text-brand-black">{appointment.location || "—"}</dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="font-medium">Date &amp; time</span>
            <input
              type="datetime-local"
              required
              value={startsLocal}
              onChange={(e) => setStartsLocal(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Location</span>
            <input
              type="text"
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              disabled={busy}
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium">Timezone</span>
            <input
              type="text"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              disabled={busy}
              placeholder="America/New_York"
              className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={busy}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-brand-black hover:bg-neutral-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm font-medium text-brand-green">
          Intake appointment updated. Reminder emails were reset for the new time.
        </p>
      ) : null}
    </form>
  );
}
