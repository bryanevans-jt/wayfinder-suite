"use client";

import { MEETING_TIMEZONES } from "@wayfinder/branding";
import { friendlyClientError } from "@wayfinder/supabase/error-log";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createMeetingRequest } from "./meeting-actions";

type Props = {
  clientId: string;
  serviceId: string | null;
  serviceName: string | null;
};

export function ClientMeetingForm({ clientId, serviceId, serviceName }: Props) {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [location, setLocation] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      try {
        await createMeetingRequest({
          clientId,
          serviceId,
          date,
          time,
          timezone,
          location,
          address: address.trim() || undefined,
        });
        setDate("");
        setTime("");
        setLocation("");
        setAddress("");
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-black/60">
        Send meeting request
      </h2>
      <p className="mt-1 text-xs text-brand-black/60">
        Client can accept or decline. Appears on their dashboard and activity feed.
        {serviceName ? ` Service: ${serviceName}.` : ""}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-sm font-medium text-brand-black">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black">
          Time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black sm:col-span-2">
          Time zone
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          >
            {MEETING_TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>
                {tz.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-brand-black sm:col-span-2">
          Place
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Location"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
        <label className="block text-sm font-medium text-brand-black sm:col-span-2">
          Address <span className="font-normal text-brand-black/50">(optional)</span>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Street address, suite, or video link details"
            className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
            disabled={pending}
          />
        </label>
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={pending || !date || !time || !location.trim()}
        className="mt-4 rounded-lg bg-brand-green px-4 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send meeting invite"}
      </button>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
