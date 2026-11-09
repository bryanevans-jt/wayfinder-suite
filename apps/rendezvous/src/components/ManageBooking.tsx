"use client";

import { useEffect, useState } from "react";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

type Slot = { start: string; end: string };

function formatEastern(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function ManageCancel({ token }: { token: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function cancel() {
    setStatus(null);
    const res = await fetch("/api/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      setStatus(data.error || "Cancel failed");
      return;
    }
    setDone(true);
  }

  if (done) {
    return <p className="text-lg">Your meeting has been cancelled.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg">Cancel this meeting?</p>
      <button type="button" className="rv-btn-primary" onClick={() => void cancel()}>
        Yes, cancel meeting
      </button>
      {status ? <p className="text-sm text-red-700">{status}</p> : null}
    </div>
  );
}

export function ManageReschedule({ token, slug }: { token: string; slug: string }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/slots?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as { slots?: Slot[]; error?: string };
      if (res.ok) setSlots(data.slots ?? []);
      else setStatus(data.error || "Unable to load times");
    })();
  }, [slug]);

  async function save() {
    if (!selected) return;
    const res = await fetch("/api/reschedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, startsAt: selected }),
    });
    const data = (await res.json()) as { error?: string; whenLabel?: string };
    if (!res.ok) {
      setStatus(data.error || "Reschedule failed");
      return;
    }
    setDone(data.whenLabel || formatEastern(selected));
  }

  if (done) {
    return <p className="text-lg">Rescheduled to {done}.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg">Pick a new time</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            className={`rounded-lg border px-3 py-2 text-sm ${
              selected === slot.start
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-green/25 bg-white"
            }`}
            onClick={() => setSelected(slot.start)}
          >
            {formatEastern(slot.start)}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="rv-btn-primary"
        disabled={!selected}
        onClick={() => void save()}
      >
        Confirm new time
      </button>
      {status ? <p className="text-sm text-red-700">{status}</p> : null}
    </div>
  );
}
