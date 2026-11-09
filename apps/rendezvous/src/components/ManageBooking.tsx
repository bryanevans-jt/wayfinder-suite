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
    return <p className="text-lg">Your Meeting Has Been Cancelled.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold">Cancel This Meeting?</p>
      <button type="button" className="rv-btn-primary" onClick={() => void cancel()}>
        Yes, Cancel Meeting
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
      else setStatus(data.error || "Unable To Load Times");
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
      setStatus(data.error || "Reschedule Failed");
      return;
    }
    setDone(data.whenLabel || formatEastern(selected));
  }

  if (done) {
    return <p className="text-lg">Rescheduled To {done}.</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-lg font-semibold">Pick A New Time</p>
      <div className="flex flex-wrap gap-2">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              selected === slot.start
                ? "border-transparent text-white"
                : "border-[color:var(--rv-line)] bg-white/80"
            }`}
            style={
              selected === slot.start
                ? {
                    background: "linear-gradient(135deg, #3C6C25, #2a6a3a 55%, #1f5c6b)",
                  }
                : undefined
            }
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
        Confirm New Time
      </button>
      {status ? <p className="text-sm text-red-700">{status}</p> : null}
    </div>
  );
}
