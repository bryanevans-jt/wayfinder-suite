"use client";

import { useEffect, useMemo, useState } from "react";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

type Booking = {
  id: string;
  staff_user_id: string;
  staffName: string;
  starts_at: string;
  ends_at: string;
  counselor_name: string;
  meeting_format: string;
  location: string | null;
  meet_link: string | null;
};

type ViewMode = "day" | "week" | "month";

const COLORS = [
  "#3C6C25",
  "#1F5C6B",
  "#7EB6C9",
  "#8B5E34",
  "#365314",
  "#0F766E",
  "#5B4B8A",
  "#9A3412",
];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function rangeForView(anchor: Date, view: ViewMode): { from: Date; to: Date } {
  const day = startOfDay(anchor);
  if (view === "day") return { from: day, to: addDays(day, 1) };
  if (view === "week") {
    const dow = day.getDay();
    const sunday = addDays(day, -dow);
    return { from: sunday, to: addDays(sunday, 7) };
  }
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const nextMonth = new Date(day.getFullYear(), day.getMonth() + 1, 1);
  return { from: first, to: nextMonth };
}

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function TeamCalendar() {
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { from, to } = useMemo(() => rangeForView(anchor, view), [anchor, view]);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/calendar?${params}`);
      const data = (await res.json()) as { bookings?: Booking[]; error?: string };
      if (!res.ok) {
        setError(data.error || "Unable To Load Calendar");
        setBookings([]);
      } else {
        setBookings(data.bookings ?? []);
      }
      setLoading(false);
    })();
  }, [from, to]);

  const people = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of bookings) map.set(b.staff_user_id, b.staffName);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [bookings]);

  const colorByStaff = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach(([id], i) => map.set(id, COLORS[i % COLORS.length]));
    return map;
  }, [people]);

  const visible = bookings.filter((b) => !hidden.has(b.staff_user_id));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {(["day", "week", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            className={view === mode ? "rv-btn-primary" : "rv-btn-secondary"}
            onClick={() => setView(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
        <button
          type="button"
          className="rv-btn-secondary"
          onClick={() => setAnchor(addDays(anchor, view === "month" ? -28 : view === "week" ? -7 : -1))}
        >
          Previous
        </button>
        <button type="button" className="rv-btn-secondary" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button
          type="button"
          className="rv-btn-secondary"
          onClick={() => setAnchor(addDays(anchor, view === "month" ? 28 : view === "week" ? 7 : 1))}
        >
          Next
        </button>
      </div>

      {people.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {people.map(([id, name]) => {
            const checked = !hidden.has(id);
            return (
              <label
                key={id}
                className="flex items-center gap-2 rounded-xl border border-[color:var(--rv-line)] bg-white/70 px-3 py-2 text-sm backdrop-blur-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    setHidden((prev) => {
                      const next = new Set(prev);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    });
                  }}
                />
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: colorByStaff.get(id) }}
                />
                {name}
              </label>
            );
          })}
        </div>
      ) : null}

      {loading ? <p className="text-brand-black/60">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {visible.length === 0 && !loading ? (
          <div className="rv-panel rounded-3xl px-6 py-14 text-center">
            <p className="rv-display text-2xl">No Bookings In This Range</p>
            <p className="mt-2 text-brand-black/65">Try another day, week, or month.</p>
          </div>
        ) : null}
        {visible.map((b) => (
          <article
            key={b.id}
            className="rv-panel rounded-2xl px-5 py-4 transition hover:-translate-y-0.5"
            style={{ borderLeftWidth: 5, borderLeftColor: colorByStaff.get(b.staff_user_id) }}
          >
            <p className="text-lg font-semibold text-brand-green">{formatWhen(b.starts_at)}</p>
            <p className="mt-1 text-sm text-brand-black/80">
              {b.staffName} · With {b.counselor_name}
            </p>
            <p className="mt-1 text-sm text-brand-black/55">
              {b.meeting_format === "google_meet"
                ? b.meet_link || "Google Meet"
                : b.location || "In Person"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
