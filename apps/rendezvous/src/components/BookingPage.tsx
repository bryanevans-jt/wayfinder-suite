"use client";

import { useEffect, useMemo, useState } from "react";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import { AppShell } from "@/components/AppShell";

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

function formatDayHeading(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
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
        setStatus(data.error || "Unable To Load Times");
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
      setStatus(data.error || "Booking Failed");
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
      <AppShell>
        <section className="rv-hero-plane rv-hero-plane-compact">
          <div className="rv-hero-content mx-auto max-w-5xl">
            <p className="rv-kicker rv-rise">Confirmed</p>
            <h1 className="rv-brand rv-rise rv-rise-delay-1 mt-2 text-4xl sm:text-5xl">
              You&apos;re Booked
            </h1>
            <p className="rv-rise rv-rise-delay-2 mt-3 max-w-xl text-brand-black/75">
              Meeting with <strong>{staffName}</strong> on {done.whenLabel}.
            </p>
          </div>
        </section>
        <div className="rv-shell space-y-4 pb-16 pt-6">
          <p className="text-sm text-brand-black/70">
            A confirmation email is on the way when email sending is enabled.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            {done.cancelUrl ? (
              <a className="rv-btn-secondary" href={done.cancelUrl}>
                Cancel Meeting
              </a>
            ) : null}
            {done.rescheduleUrl ? (
              <a className="rv-btn-secondary" href={done.rescheduleUrl}>
                Reschedule Meeting
              </a>
            ) : null}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="rv-hero-plane rv-hero-plane-compact">
        <div className="rv-hero-content mx-auto max-w-5xl">
          <p className="rv-rise rv-brand text-3xl sm:text-4xl">Rendezvous</p>
          <h1 className="rv-display rv-rise rv-rise-delay-1 mt-3 text-3xl sm:text-4xl md:text-5xl">
            Book With {staffName}
          </h1>
          <p className="rv-rise rv-rise-delay-2 mt-3 max-w-2xl text-brand-black/75">
            Pick a time that works for you. Times are shown in Eastern Time.
          </p>
        </div>
      </section>

      <div className="rv-shell space-y-6 pb-16 pt-6">
        <div className="space-y-3">
          <p className="rounded-2xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950">
            Please do <strong>not</strong> enter sensitive client information on this form.
          </p>
          <p className="rounded-2xl border border-[color:var(--rv-line)] bg-white/70 px-4 py-3 text-sm text-brand-black/70">
            Availability is subject to change.
          </p>
        </div>

        {loading ? <p className="text-brand-black/60">Loading Open Times…</p> : null}
        {!loading && slots.length === 0 && !status ? (
          <div className="rv-panel rounded-3xl px-6 py-12 text-center">
            <p className="rv-display text-2xl">No Open Times Right Now</p>
            <p className="mt-2 text-brand-black/65">Please check back later.</p>
          </div>
        ) : null}

        <div className="space-y-8">
          {grouped.map(([day, daySlots]) => (
            <div key={day}>
              <h2 className="rv-display text-2xl">{formatDayHeading(day)}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {daySlots.map((slot) => (
                  <button
                    key={slot.start}
                    type="button"
                    className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      selected === slot.start
                        ? "border-transparent text-white"
                        : "border-[color:var(--rv-line)] bg-white/80 hover:bg-white"
                    }`}
                    style={
                      selected === slot.start
                        ? {
                            background:
                              "linear-gradient(135deg, #3C6C25, #2a6a3a 55%, #1f5c6b)",
                          }
                        : undefined
                    }
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
          <div className="rv-panel space-y-5 rounded-3xl p-6">
            <h2 className="rv-display text-2xl">Confirm Details</h2>
            <p className="font-semibold text-brand-green">Selected: {formatEastern(selected)}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-semibold">Your Name</label>
                <input
                  className="rv-input"
                  value={counselorName}
                  onChange={(e) => setCounselorName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold">Your Email</label>
                <input
                  type="email"
                  className="rv-input"
                  value={counselorEmail}
                  onChange={(e) => setCounselorEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">Meeting Format</legend>
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
                In Person
              </label>
            </fieldset>

            {meetingFormat === "in_person" ? (
              <div>
                <label className="block text-sm font-semibold">Location (Optional Override)</label>
                <input
                  className="rv-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={defaultLocation || "Meeting Location"}
                />
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-semibold">Short Reason (Optional)</label>
              <textarea
                className="rv-input"
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
              {submitting ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        ) : null}

        {status ? <p className="text-sm text-red-700">{status}</p> : null}
      </div>
    </AppShell>
  );
}
