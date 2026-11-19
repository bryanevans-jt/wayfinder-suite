import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectScopedTeamCalendarEvents,
  mergeTeamCalendarEvents,
} from "./team-calendar-events";

describe("mergeTeamCalendarEvents", () => {
  it("keeps Rendezvous booking details and drops the matching Google event", () => {
    const merged = mergeTeamCalendarEvents({
      staffUserId: "es-1",
      staffName: "Kayla",
      bookings: [
        {
          id: "b1",
          staff_user_id: "es-1",
          starts_at: "2026-11-20T15:00:00.000Z",
          ends_at: "2026-11-20T16:00:00.000Z",
          counselor_name: "Jane Counselor",
          meeting_format: "google_meet",
          location: null,
          meet_link: "https://meet.google.com/abc",
          reason: "Intake",
          notes: "Bring forms",
          google_event_id: "g-rendezvous-1",
        },
      ],
      googleEvents: [
        {
          googleEventId: "g-rendezvous-1",
          title: "Counselor booking",
          startsAt: "2026-11-20T15:00:00.000Z",
          endsAt: "2026-11-20T16:00:00.000Z",
          allDay: false,
          location: null,
          meetLink: "https://meet.google.com/abc",
          description: "thin google copy",
          visibility: "default",
          status: "confirmed",
        },
        {
          googleEventId: "g-other",
          title: "Team standup",
          startsAt: "2026-11-20T14:00:00.000Z",
          endsAt: "2026-11-20T14:30:00.000Z",
          allDay: false,
          location: "Room A",
          meetLink: null,
          description: "Weekly",
          visibility: "private",
          status: "confirmed",
        },
      ],
    });

    assert.equal(merged.length, 2);
    assert.equal(merged[0].source, "google");
    assert.equal(merged[0].title, "Team standup");
    assert.equal(merged[0].visibility, "private");
    assert.equal(merged[1].source, "rendezvous");
    assert.equal(merged[1].title, "Rendezvous · Jane Counselor");
    assert.equal(merged[1].reason, "Intake");
    assert.equal(merged[1].notes, "Bring forms");
  });

  it("skips cancelled Google events", () => {
    const merged = mergeTeamCalendarEvents({
      staffUserId: "es-1",
      staffName: "Kayla",
      bookings: [],
      googleEvents: [
        {
          googleEventId: "gone",
          title: "Cancelled",
          startsAt: "2026-11-20T10:00:00.000Z",
          endsAt: "2026-11-20T11:00:00.000Z",
          allDay: false,
          location: null,
          meetLink: null,
          description: null,
          visibility: null,
          status: "cancelled",
        },
      ],
    });
    assert.deepEqual(merged, []);
  });
});

describe("collectScopedTeamCalendarEvents", () => {
  it("never returns events for staff outside the allow-list", () => {
    const events = collectScopedTeamCalendarEvents({
      allowedStaffUserIds: ["es-1"],
      perStaff: [
        {
          staffUserId: "es-1",
          staffName: "Kayla",
          bookings: [],
          googleEvents: [
            {
              googleEventId: "ok",
              title: "Mine",
              startsAt: "2026-11-20T10:00:00.000Z",
              endsAt: "2026-11-20T11:00:00.000Z",
              allDay: false,
              location: null,
              meetLink: null,
              description: null,
              visibility: null,
              status: "confirmed",
            },
          ],
        },
        {
          staffUserId: "other",
          staffName: "Other",
          bookings: [],
          googleEvents: [
            {
              googleEventId: "nope",
              title: "Secret",
              startsAt: "2026-11-20T10:00:00.000Z",
              endsAt: "2026-11-20T11:00:00.000Z",
              allDay: false,
              location: null,
              meetLink: null,
              description: null,
              visibility: null,
              status: "confirmed",
            },
          ],
        },
      ],
    });
    assert.equal(events.length, 1);
    assert.equal(events[0].staffUserId, "es-1");
  });
});
