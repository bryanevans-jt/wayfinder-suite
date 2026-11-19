/**
 * Pure helpers for Team Calendar event merge / dedupe.
 * Rendezvous bookings that already exist as Google events (google_event_id)
 * win so the richer booking fields (counselor, reason, notes) are kept.
 */

export type GoogleCalendarEventPayload = {
  googleEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  meetLink: string | null;
  description: string | null;
  visibility: string | null;
  status: string | null;
};

export type RendezvousBookingPayload = {
  id: string;
  staff_user_id: string;
  starts_at: string;
  ends_at: string;
  counselor_name: string;
  meeting_format: string;
  location: string | null;
  meet_link: string | null;
  reason: string | null;
  notes: string | null;
  google_event_id: string | null;
};

export type TeamCalendarEvent = {
  id: string;
  staffUserId: string;
  staffName: string;
  source: "rendezvous" | "google";
  googleEventId: string | null;
  bookingId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  location: string | null;
  meetLink: string | null;
  description: string | null;
  counselorName: string | null;
  reason: string | null;
  notes: string | null;
  meetingFormat: string | null;
  visibility: string | null;
};

export function mergeTeamCalendarEvents(opts: {
  staffUserId: string;
  staffName: string;
  bookings: RendezvousBookingPayload[];
  googleEvents: GoogleCalendarEventPayload[];
}): TeamCalendarEvent[] {
  const bookingGoogleIds = new Set(
    opts.bookings
      .map((b) => b.google_event_id)
      .filter((id): id is string => Boolean(id))
  );

  const fromBookings: TeamCalendarEvent[] = opts.bookings.map((b) => ({
    id: `booking:${b.id}`,
    staffUserId: opts.staffUserId,
    staffName: opts.staffName,
    source: "rendezvous",
    googleEventId: b.google_event_id,
    bookingId: b.id,
    title: `Rendezvous · ${b.counselor_name}`,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    allDay: false,
    location: b.location,
    meetLink: b.meet_link,
    description: [b.reason, b.notes].filter(Boolean).join("\n\n") || null,
    counselorName: b.counselor_name,
    reason: b.reason,
    notes: b.notes,
    meetingFormat: b.meeting_format,
    visibility: null,
  }));

  const fromGoogle: TeamCalendarEvent[] = opts.googleEvents
    .filter((g) => !bookingGoogleIds.has(g.googleEventId))
    .filter((g) => (g.status ?? "confirmed") !== "cancelled")
    .map((g) => ({
      id: `google:${opts.staffUserId}:${g.googleEventId}`,
      staffUserId: opts.staffUserId,
      staffName: opts.staffName,
      source: "google" as const,
      googleEventId: g.googleEventId,
      bookingId: null,
      title: g.title?.trim() || "(No title)",
      startsAt: g.startsAt,
      endsAt: g.endsAt,
      allDay: g.allDay,
      location: g.location,
      meetLink: g.meetLink,
      description: g.description,
      counselorName: null,
      reason: null,
      notes: null,
      meetingFormat: null,
      visibility: g.visibility,
    }));

  return [...fromBookings, ...fromGoogle].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}

/** Flatten per-staff merges and drop anything outside the allow-list. */
export function collectScopedTeamCalendarEvents(opts: {
  allowedStaffUserIds: string[];
  perStaff: Array<{
    staffUserId: string;
    staffName: string;
    bookings: RendezvousBookingPayload[];
    googleEvents: GoogleCalendarEventPayload[];
  }>;
}): TeamCalendarEvent[] {
  const allowed = new Set(opts.allowedStaffUserIds);
  const out: TeamCalendarEvent[] = [];
  for (const row of opts.perStaff) {
    if (!allowed.has(row.staffUserId)) continue;
    out.push(
      ...mergeTeamCalendarEvents({
        staffUserId: row.staffUserId,
        staffName: row.staffName,
        bookings: row.bookings.filter((b) => allowed.has(b.staff_user_id)),
        googleEvents: row.googleEvents,
      })
    );
  }
  return out.sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  );
}
