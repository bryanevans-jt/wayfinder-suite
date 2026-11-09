"use client";

import { useEffect, useMemo, useState } from "react";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import { AppShell } from "@/components/AppShell";

type Slot = { start: string; end: string };

function formatEasternFull(iso: string): string {
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

function formatTimeOnly(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    hour: "numeric",
    minute: "2-digit",
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
    "in_person"
  );
  const [location, setLocation] = useState("");
  const [reason, setReason] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
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
    setWarning(null);
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
      calendarSyncWarning?: string | null;
    };
    setSubmitting(false);
    if (!res.ok) {
      setStatus(data.error || "Booking Failed");
      return;
    }
    if (data.calendarSyncWarning) {
      setWarning(data.calendarSyncWarning);
    }
    setDone({
      whenLabel: data.whenLabel || formatEasternFull(selected),
      cancelUrl: data.cancelUrl || "",
      rescheduleUrl: data.rescheduleUrl || "",
    });
  }

  if (done) {
    return (
      <AppShell>
        <section className="rv-book-header">
          <div className="rv-shell !py-8 sm:!py-10">
            <p className="rv-kicker rv-rise">Confirmed</p>
            <h1 className="rv-brand rv-rise rv-rise-delay-1 mt-2 text-4xl sm:text-5xl">
              You&apos;re Booked
            </h1>
            <p className="rv-rise rv-rise-delay-2 mt-3 max-w-xl text-lg text-[color:var(--rv-ink-soft)]">
              Meeting with <strong className="text-[color:var(--rv-ink)]">{staffName}</strong> on{" "}
              {done.whenLabel}.
            </p>
          </div>
        </section>
        <div className="rv-shell space-y-5 !pt-2 pb-16">
          {warning ? (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              {warning}
            </p>
          ) : null}
          <p className="text-sm text-[color:var(--rv-ink-soft)]">
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
      <section className="rv-book-header">
        <div className="rv-shell !py-8 sm:!py-10">
          <p className="rv-rise rv-brand text-3xl sm:text-4xl">Rendezvous</p>
          <h1 className="rv-display rv-rise rv-rise-delay-1 mt-3 text-3xl sm:text-4xl md:text-[2.75rem]">
            Book With {staffName}
          </h1>
          <p className="rv-rise rv-rise-delay-2 mt-3 max-w-xl text-[color:var(--rv-ink-soft)]">
            Choose a day, then pick a time. All times are Eastern.
          </p>
        </div>
      </section>

      <div className="rv-shell space-y-8 !pt-2 pb-16">
        <div className="rv-notice-row rv-rise rv-rise-delay-3">
          <p className="rv-notice rv-notice-caution">
            Please do <strong>not</strong> enter sensitive client information on this form.
          </p>
          <p className="rv-notice">Availability is subject to change.</p>
        </div>

        {loading ? (
          <div className="rv-slot-skeleton" aria-live="polite">
            <span className="rv-pulse-dot" />
            Loading open times…
          </div>
        ) : null}

        {!loading && slots.length === 0 && !status ? (
          <div className="rv-empty-state">
            <p className="rv-display text-2xl">No Open Times Right Now</p>
            <p className="mt-2 text-[color:var(--rv-ink-soft)]">Please check back later.</p>
          </div>
        ) : null}

        <div className="space-y-10">
          {grouped.map(([day, daySlots], dayIndex) => (
            <section
              key={day}
              className="rv-day-block"
              style={{ animationDelay: `${Math.min(dayIndex, 6) * 0.05 + 0.12}s` }}
            >
              <header className="rv-day-heading">
                <h2 className="rv-display text-xl sm:text-2xl">{formatDayHeading(day)}</h2>
                <span className="rv-day-count">
                  {daySlots.length} {daySlots.length === 1 ? "time" : "times"}
                </span>
              </header>
              <div className="rv-time-grid">
                {daySlots.map((slot) => {
                  const isSelected = selected === slot.start;
                  return (
                    <button
                      key={slot.start}
                      type="button"
                      className={`rv-time-chip${isSelected ? " is-selected" : ""}`}
                      aria-pressed={isSelected}
                      onClick={() => setSelected(slot.start)}
                    >
                      {formatTimeOnly(slot.start)}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {selected ? (
          <div className="rv-confirm-panel rv-rise">
            <div className="rv-confirm-top">
              <h2 className="rv-display text-2xl">Confirm Details</h2>
              <p className="rv-selected-when">{formatEasternFull(selected)}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="rv-label" htmlFor="counselor-name">
                  Your Name
                </label>
                <input
                  id="counselor-name"
                  className="rv-input"
                  value={counselorName}
                  onChange={(e) => setCounselorName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="rv-label" htmlFor="counselor-email">
                  Your Email
                </label>
                <input
                  id="counselor-email"
                  type="email"
                  className="rv-input"
                  value={counselorEmail}
                  onChange={(e) => setCounselorEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <fieldset className="space-y-3">
              <legend className="rv-label">Meeting Format</legend>
              <div className="rv-format-row">
                <label className={`rv-format-option${meetingFormat === "in_person" ? " is-active" : ""}`}>
                  <input
                    type="radio"
                    name="format"
                    checked={meetingFormat === "in_person"}
                    onChange={() => setMeetingFormat("in_person")}
                  />
                  <span>In Person</span>
                </label>
                <label className={`rv-format-option${meetingFormat === "google_meet" ? " is-active" : ""}`}>
                  <input
                    type="radio"
                    name="format"
                    checked={meetingFormat === "google_meet"}
                    onChange={() => setMeetingFormat("google_meet")}
                  />
                  <span>Virtual</span>
                </label>
              </div>
            </fieldset>

            {meetingFormat === "in_person" ? (
              <div>
                <label className="rv-label" htmlFor="meeting-location">
                  Location (Optional Override)
                </label>
                <input
                  id="meeting-location"
                  className="rv-input"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder={defaultLocation || "Meeting Location"}
                />
              </div>
            ) : null}

            <div>
              <label className="rv-label" htmlFor="meeting-reason">
                Short Reason (Optional)
              </label>
              <textarea
                id="meeting-reason"
                className="rv-input"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <button
              type="button"
              className="rv-btn-primary w-full sm:w-auto"
              disabled={submitting || !counselorName.trim() || !counselorEmail.trim()}
              onClick={() => void book()}
            >
              {submitting ? "Booking…" : "Confirm Booking"}
            </button>
          </div>
        ) : null}

        {status ? <p className="text-sm font-medium text-red-700">{status}</p> : null}
      </div>
    </AppShell>
  );
}
