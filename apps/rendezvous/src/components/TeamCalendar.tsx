"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import type { EventClickArg, EventContentArg } from "@fullcalendar/core";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import {
  resolveTeamCalendarPeoplePickerIds,
  type TeamCalendarStaffMember,
} from "@/lib/team-calendar-staff";
import type { TeamCalendarEvent } from "@/lib/team-calendar-events";

type ViewMode = "day" | "week" | "month";

type PersonError = {
  staffUserId: string;
  staffName: string;
  message: string;
};

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
  // Month grid shows leading/trailing days — fetch a padded window.
  const first = new Date(day.getFullYear(), day.getMonth(), 1);
  const padStart = addDays(first, -first.getDay());
  const nextMonth = new Date(day.getFullYear(), day.getMonth() + 1, 1);
  const lastVisible = addDays(nextMonth, 6 - nextMonth.getDay());
  return { from: padStart, to: addDays(lastVisible, 1) };
}

function fullCalendarView(view: ViewMode, narrow: boolean): string {
  if (narrow) {
    if (view === "month") return "listMonth";
    if (view === "week") return "listWeek";
    return "listDay";
  }
  if (view === "month") return "dayGridMonth";
  if (view === "week") return "timeGridWeek";
  return "timeGridDay";
}

function formatDetailWhen(iso: string, allDay: boolean) {
  if (allDay) {
    // All-day values are YYYY-MM-DD — parse as local calendar date.
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso;
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(dateOnly));
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function EventDetailModal({
  event,
  color,
  onClose,
}: {
  event: TeamCalendarEvent;
  color: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rv-event-title"
      onClick={onClose}
    >
      <div
        className="rv-panel max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl px-5 py-5 shadow-xl"
        style={{ borderTopWidth: 6, borderTopColor: color }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-black/50">
              {event.staffName}
              {event.source === "rendezvous" ? " · Rendezvous" : " · Google"}
              {event.visibility === "private" ? " · Private" : ""}
            </p>
            <h2 id="rv-event-title" className="mt-1 text-xl font-semibold text-brand-green">
              {event.title}
            </h2>
          </div>
          <button type="button" className="rv-btn-secondary shrink-0" onClick={onClose}>
            Close
          </button>
        </div>
        <dl className="mt-4 space-y-3 text-sm text-brand-black/80">
          <div>
            <dt className="font-medium text-brand-black/55">When</dt>
            <dd>
              {formatDetailWhen(event.startsAt, event.allDay)}
              {!event.allDay ? ` – ${formatDetailWhen(event.endsAt, false)}` : null}
            </dd>
          </div>
          {event.counselorName ? (
            <div>
              <dt className="font-medium text-brand-black/55">Counselor</dt>
              <dd>{event.counselorName}</dd>
            </div>
          ) : null}
          {event.meetLink || event.location || event.meetingFormat ? (
            <div>
              <dt className="font-medium text-brand-black/55">Where</dt>
              <dd>
                {event.meetLink ? (
                  <a
                    href={event.meetLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-green underline"
                  >
                    {event.meetLink}
                  </a>
                ) : event.location ? (
                  event.location
                ) : event.meetingFormat === "google_meet" ? (
                  "Virtual"
                ) : event.meetingFormat === "in_person" ? (
                  "In Person"
                ) : null}
              </dd>
            </div>
          ) : null}
          {event.reason ? (
            <div>
              <dt className="font-medium text-brand-black/55">Reason</dt>
              <dd>{event.reason}</dd>
            </div>
          ) : null}
          {event.notes ? (
            <div>
              <dt className="font-medium text-brand-black/55">Notes</dt>
              <dd className="whitespace-pre-wrap">{event.notes}</dd>
            </div>
          ) : null}
          {event.description && !event.reason && !event.notes ? (
            <div>
              <dt className="font-medium text-brand-black/55">Description</dt>
              <dd className="whitespace-pre-wrap">{event.description}</dd>
            </div>
          ) : event.description && (event.reason || event.notes) ? (
            <div>
              <dt className="font-medium text-brand-black/55">Description</dt>
              <dd className="whitespace-pre-wrap">{event.description}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </div>
  );
}

export function TeamCalendar() {
  const calendarRef = useRef<FullCalendar | null>(null);
  const [view, setView] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [events, setEvents] = useState<TeamCalendarEvent[]>([]);
  const [staff, setStaff] = useState<TeamCalendarStaffMember[]>([]);
  const [personErrors, setPersonErrors] = useState<PersonError[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [selected, setSelected] = useState<TeamCalendarEvent | null>(null);

  const { from, to } = useMemo(() => rangeForView(anchor, view), [anchor, view]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/calendar?${params}`);
      const data = (await res.json()) as {
        events?: TeamCalendarEvent[];
        staff?: TeamCalendarStaffMember[];
        errors?: PersonError[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || "Unable To Load Calendar");
        setEvents([]);
        setStaff([]);
        setPersonErrors([]);
      } else {
        setEvents(data.events ?? []);
        setStaff(data.staff ?? []);
        setPersonErrors(data.errors ?? []);
      }
      setLoading(false);
    })();
  }, [from, to]);

  const people = useMemo(() => {
    const ids = resolveTeamCalendarPeoplePickerIds({
      staff,
      bookingStaffUserIds: events.map((e) => e.staffUserId),
    });
    const nameById = new Map(staff.map((s) => [s.id, s.name]));
    for (const e of events) {
      if (!nameById.has(e.staffUserId)) nameById.set(e.staffUserId, e.staffName);
    }
    return ids
      .map((id) => [id, nameById.get(id) || "Staff"] as const)
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [staff, events]);

  const colorByStaff = useMemo(() => {
    const map = new Map<string, string>();
    people.forEach(([id], i) => map.set(id, COLORS[i % COLORS.length]));
    return map;
  }, [people]);

  const visibleEvents = useMemo(
    () => events.filter((e) => !hidden.has(e.staffUserId)),
    [events, hidden]
  );

  const fcEvents = useMemo(
    () =>
      visibleEvents.map((e) => {
        const color = colorByStaff.get(e.staffUserId) ?? COLORS[0];
        return {
          id: e.id,
          title: e.title,
          start: e.startsAt,
          end: e.endsAt,
          allDay: e.allDay,
          backgroundColor: color,
          borderColor: color,
          textColor: "#ffffff",
          extendedProps: { teamEvent: e },
        };
      }),
    [visibleEvents, colorByStaff]
  );

  const fcView = fullCalendarView(view, narrow);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(fcView);
    api.gotoDate(anchor);
  }, [fcView, anchor]);

  function onEventClick(arg: EventClickArg) {
    const teamEvent = arg.event.extendedProps.teamEvent as TeamCalendarEvent | undefined;
    if (teamEvent) setSelected(teamEvent);
  }

  function renderEventContent(arg: EventContentArg) {
    const teamEvent = arg.event.extendedProps.teamEvent as TeamCalendarEvent | undefined;
    const label = teamEvent
      ? `${teamEvent.staffName}: ${teamEvent.title}`
      : arg.event.title;
    return (
      <div className="fc-event-main-frame overflow-hidden px-0.5 leading-tight">
        {!arg.event.allDay ? (
          <div className="fc-event-time text-[10px] opacity-90">{arg.timeText}</div>
        ) : null}
        <div className="fc-event-title fc-sticky truncate text-[11px] font-semibold sm:text-xs">
          {label}
        </div>
      </div>
    );
  }

  const rangeLabel = useMemo(() => {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: PORTAL_DISPLAY_TIME_ZONE,
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    if (view === "day") return fmt.format(anchor);
    return `${fmt.format(from)} – ${fmt.format(addDays(to, -1))}`;
  }, [anchor, from, to, view]);

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
        <button
          type="button"
          className="rv-btn-secondary"
          onClick={() =>
            setAnchor(
              addDays(anchor, view === "month" ? -28 : view === "week" ? -7 : -1)
            )
          }
        >
          Previous
        </button>
        <button type="button" className="rv-btn-secondary" onClick={() => setAnchor(new Date())}>
          Today
        </button>
        <button
          type="button"
          className="rv-btn-secondary"
          onClick={() =>
            setAnchor(addDays(anchor, view === "month" ? 28 : view === "week" ? 7 : 1))
          }
        >
          Next
        </button>
        <p className="ml-auto text-sm font-medium text-brand-black/65">{rangeLabel}</p>
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
      {personErrors.length > 0 ? (
        <div className="rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">Some calendars could not be loaded</p>
          <ul className="mt-1 list-disc pl-5">
            {personErrors.map((e) => (
              <li key={e.staffUserId}>
                {e.staffName}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rv-panel rv-calendar overflow-hidden rounded-3xl p-2 sm:p-4">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView={fcView}
          initialDate={anchor}
          headerToolbar={false}
          height="auto"
          expandRows
          nowIndicator
          weekends
          timeZone={PORTAL_DISPLAY_TIME_ZONE}
          events={fcEvents}
          eventClick={onEventClick}
          eventContent={renderEventContent}
          dayMaxEvents={narrow ? 3 : 4}
          slotMinTime="06:00:00"
          slotMaxTime="21:00:00"
          allDaySlot
          stickyHeaderDates
        />
        {!loading && visibleEvents.length === 0 ? (
          <p className="px-4 pb-6 text-center text-sm text-brand-black/55">
            No events in this range
            {people.length > 1 ? " — try another view or toggle people." : "."}
          </p>
        ) : null}
      </div>

      {selected ? (
        <EventDetailModal
          event={selected}
          color={colorByStaff.get(selected.staffUserId) ?? COLORS[0]}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}
