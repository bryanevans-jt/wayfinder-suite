"use client";

import { useEffect, useMemo, useState } from "react";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

type Slot = { start: string; end: string };

function formatEastern(iso: string): string {
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

export function BookingPage({
  slug,
  staffName,
}: {
  slug: string;
  staffName: string;
}) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [defaultLocation, setDefaultLocation] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [counselorName, setCounselorName] = useState("");
  const [counselorEmail, setCounselorEmail] = useState("");
  const [meetingFormat, setMeetingFormat] = useState<"in_person" | "google_meet">(
    "google_meet"
  );
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [done, setDone] = useState<{ whenLabel: string; cancelUrl: string; rescheduleUrl: string } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch(`/api/slots?slug=${encodeURIComponent(slug)}`);
      const data = (await res.json()) as {
        slots?: Slot[];
        defaultLocation?: string | null;
        error?: string;
      };
      if (res.ok) {
        setSlots(data.slots ?? []);
        setDefaultLocation(data.defaultLocation ?? null);
      } else {
        setStatus(data.error || "Unable to load times");
      }
      setLoading(false);
    })();
  }, [slug]);

  const grouped = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const day = new Intl.DateTimeFormat("en-CA", {
        timeZone: PORTAL_DISPLAY_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(slot.start));
      const list = map.get(day) ?? [];
      list.push(slot);
      map.set(day, list);
    }
    return [...map.entries()];
  }, [slots]);

  async function book() {
    if (!selected) return;
    setSubmitting(true);
    setStatus(null);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug,
        startsAt: selected,
        counselorName,
        counselorEmail,
        meetingFormat,
        location: meetingFormat === "in_person" ? location || defaultLocation : null,
        reason,
      }),
    });
    const data = (await res.json()) as {
      error?: string;
      whenLabel?: string;
      cancelUrl?: string;
      rescheduleUrl?: string;
    };
    setSubmitting(false);
    if (!res.ok) {
      setStatus(data.error || "Booking failed");
      return;
    }
    setDone({
      whenLabel: data.whenLabel || formatEastern(selected),
      cancelUrl: data.cancelUrl || "",
      rescheduleUrl: data.rescheduleUrl || "",
    });
  }

  if (done) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="font-[family-name:var(--font-rv-display)] text-4xl text-brand-green">
          You&apos;re booked
        </h1>
        <p className="mt-3 text-lg">
          Meeting with <strong>{staffName}</strong> on {done.whenLabel}.
        </p>
        <p className="mt-4 text-sm text-brand-black/70">
          A confirmation email is on the way (when email sending is enabled).
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {done.cancelUrl ? (
            <a className="rv-btn-secondary" href={done.cancelUrl}>
              Cancel meeting
            </a>
          ) : null}
          {done.rescheduleUrl ? (
            <a className="rv-btn-secondary" href={done.rescheduleUrl}>
              Reschedule
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-brand-gold">Rendezvous</p>
      <h1 className="mt-2 font-[family-name:var(--font-rv-display)] text-4xl text-brand-green sm:text-5xl">
        Book with {staffName}
      </h1>
      <p className="mt-3 max-w-2xl text-brand-black/75">
        Pick a time that works for you. Times are shown in Eastern Time.
      </p>
      <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
        Please do <strong>not</strong> enter sensitive client information on this form.
      </p>

      {loading ? <p className="mt-8 text-brand-black/60">Loading open times…</p> : null}
      {!loading && slots.length === 0 ? (
        <p className="mt-8 text-brand-black/70">No open times right now. Please check back later.</p>
      ) : null}

      <div className="mt-8 space-y-6">
        {grouped.map(([day, daySlots]) => (
          <div key={day}>
            <h2 className="text-lg font-semibold">{day}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              {daySlots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    selected === slot.start
                      ? "border-brand-green bg-brand-green text-white"
                      : "border-brand-green/25 bg-white hover:bg-brand-green/5"
                  }`}
                  onClick={() => setSelected(slot.start)}
                >
                  {formatEastern(slot.start)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {selected ? (
        <div className="mt-10 space-y-4 rounded-2xl border border-brand-green/15 bg-white/90 p-5 shadow-sm">
          <p className="font-semibold">Selected: {formatEastern(selected)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-semibold">Your name</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={counselorName}
                onChange={(e) => setCounselorName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold">Your email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={counselorEmail}
                onChange={(e) => setCounselorEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-semibold">Meeting format</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={meetingFormat === "google_meet"}
                onChange={() => setMeetingFormat("google_meet")}
              />
              Google Meet
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                checked={meetingFormat === "in_person"}
                onChange={() => setMeetingFormat("in_person")}
              />
              In person
            </label>
          </fieldset>

          {meetingFormat === "in_person" ? (
            <div>
              <label className="block text-sm font-semibold">Location (optional override)</label>
              <input
                className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={defaultLocation || "Meeting location"}
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-semibold">Short reason (optional)</label>
            <textarea
              className="mt-1 w-full rounded-lg border border-neutral-300 px-3 py-2"
              rows={2}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Do not include client names or sensitive details"
            />
          </div>

          <button
            type="button"
            className="rv-btn-primary"
            disabled={submitting || !counselorName.trim() || !counselorEmail.trim()}
            onClick={() => void book()}
          >
            {submitting ? "Booking…" : "Confirm booking"}
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-4 text-sm text-red-700">{status}</p> : null}
    </div>
  );
}
