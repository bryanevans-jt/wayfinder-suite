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
  "#B68035",
  "#1F4E79",
  "#8B3A3A",
  "#5B4B8A",
  "#0F766E",
  "#9A3412",
  "#365314",
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
        setError(data.error || "Unable to load calendar");
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
    <div className="space-y-6">
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
        <button type="button" className="rv-btn-secondary" onClick={() => setAnchor(addDays(anchor, view === "month" ? -28 : view === "week" ? -7 : -1))}>
          Previous
        </button>
        <button type="button" className="rv-btn-secondary" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button type="button" className="rv-btn-secondary" onClick={() => setAnchor(addDays(anchor, view === "month" ? 28 : view === "week" ? 7 : 1))}>
          Next
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        {people.map(([id, name]) => {
          const checked = !hidden.has(id);
          return (
            <label key={id} className="flex items-center gap-2 rounded-lg border border-brand-green/15 bg-white px-3 py-2 text-sm">
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
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: colorByStaff.get(id) }}
              />
              {name}
            </label>
          );
        })}
      </div>

      {loading ? <p className="text-brand-black/60">Loading…</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}

      <div className="space-y-3">
        {visible.length === 0 && !loading ? (
          <p className="text-brand-black/70">No bookings in this range.</p>
        ) : null}
        {visible.map((b) => (
          <div
            key={b.id}
            className="rounded-xl border border-brand-green/10 bg-white/90 p-4 shadow-sm"
            style={{ borderLeftWidth: 6, borderLeftColor: colorByStaff.get(b.staff_user_id) }}
          >
            <p className="font-semibold">{formatWhen(b.starts_at)}</p>
            <p className="text-sm text-brand-black/80">
              {b.staffName} · with {b.counselor_name}
            </p>
            <p className="text-sm text-brand-black/60">
              {b.meeting_format === "google_meet"
                ? b.meet_link || "Google Meet"
                : b.location || "In person"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
