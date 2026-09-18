"use client";

import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Props = {
  clientId: string;
  canWrite: boolean;
};

export function ClientIntakeSchedulePanel({ clientId, canWrite }: Props) {
  const router = useRouter();
  const [startsLocal, setStartsLocal] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setError(null);
    try {
      const startsAt = new Date(startsLocal).toISOString();
      const res = await fetch(`/api/clients/${encodeURIComponent(clientId)}/intake-appointment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt: startsAt,
          location: location.trim(),
          timezone: PORTAL_DISPLAY_TIME_ZONE,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Could not schedule intake");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not schedule intake");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="space-y-4 rounded-xl border border-brand-green/30 bg-brand-green/5 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-brand-black">Schedule intake appointment</h3>
        <p className="mt-1 text-sm text-brand-black/65">
          Enter date, time, and location in <strong>Eastern US</strong> ({PORTAL_DISPLAY_TIME_ZONE}
          ). Client reminder emails will be sent when you save.
        </p>
      </div>
      <label className="block text-sm">
        <span className="font-medium">Date &amp; time (Eastern)</span>
        <input
          type="datetime-local"
          required
          value={startsLocal}
          onChange={(e) => setStartsLocal(e.target.value)}
          disabled={!canWrite || busy}
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="font-medium">Location</span>
        <input
          type="text"
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          disabled={!canWrite || busy}
          placeholder="Office address, Zoom link, or phone"
          className="mt-1 w-full rounded-lg border border-neutral-200 bg-white px-3 py-2"
        />
      </label>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {error}
        </p>
      ) : null}
      {canWrite ? (
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
        >
          {busy ? "Saving…" : "Schedule intake"}
        </button>
      ) : null}
    </form>
  );
}
