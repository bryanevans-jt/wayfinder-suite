import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateOpenSlots,
  hasBookingConflict,
  zonedDateTimeToUtc,
} from "./slots";

describe("slot calculation + time zones", () => {
  it("generates hourly Eastern slots inside weekly hours", () => {
    // 2026-11-09 is a Monday.
    const now = zonedDateTimeToUtc(2026, 11, 8, 9, 0, "America/New_York");
    const rangeStart = zonedDateTimeToUtc(2026, 11, 9, 0, 0, "America/New_York");
    const rangeEnd = zonedDateTimeToUtc(2026, 11, 10, 0, 0, "America/New_York");

    const slots = calculateOpenSlots({
      weeklyHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }],
      meetingLengthMinutes: 60,
      bufferMinutes: 0,
      minNoticeHours: 0,
      bookingWindowDays: 14,
      now,
      rangeStart,
      rangeEnd,
      busy: [],
      timeZone: "America/New_York",
    });

    assert.equal(slots.length, 3);
    assert.equal(
      slots[0].start.toISOString(),
      zonedDateTimeToUtc(2026, 11, 9, 9, 0, "America/New_York").toISOString()
    );
    assert.equal(
      slots[2].end.toISOString(),
      zonedDateTimeToUtc(2026, 11, 9, 12, 0, "America/New_York").toISOString()
    );
  });

  it("subtracts Google busy times and respects buffer", () => {
    const now = zonedDateTimeToUtc(2026, 11, 8, 9, 0, "America/New_York");
    const rangeStart = zonedDateTimeToUtc(2026, 11, 9, 0, 0, "America/New_York");
    const rangeEnd = zonedDateTimeToUtc(2026, 11, 10, 0, 0, "America/New_York");
    const busyStart = zonedDateTimeToUtc(2026, 11, 9, 10, 0, "America/New_York");
    const busyEnd = zonedDateTimeToUtc(2026, 11, 9, 11, 0, "America/New_York");

    const slots = calculateOpenSlots({
      weeklyHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }],
      meetingLengthMinutes: 60,
      bufferMinutes: 0,
      minNoticeHours: 0,
      bookingWindowDays: 14,
      now,
      rangeStart,
      rangeEnd,
      busy: [{ start: busyStart, end: busyEnd }],
      timeZone: "America/New_York",
    });

    assert.deepEqual(
      slots.map((s) => s.start.toISOString()),
      [
        zonedDateTimeToUtc(2026, 11, 9, 9, 0, "America/New_York").toISOString(),
        zonedDateTimeToUtc(2026, 11, 9, 11, 0, "America/New_York").toISOString(),
      ]
    );
  });

  it("enforces minimum notice", () => {
    const now = zonedDateTimeToUtc(2026, 11, 9, 8, 30, "America/New_York");
    const rangeStart = zonedDateTimeToUtc(2026, 11, 9, 0, 0, "America/New_York");
    const rangeEnd = zonedDateTimeToUtc(2026, 11, 10, 0, 0, "America/New_York");

    const slots = calculateOpenSlots({
      weeklyHours: [{ dayOfWeek: 1, startTime: "09:00", endTime: "11:00" }],
      meetingLengthMinutes: 60,
      bufferMinutes: 0,
      minNoticeHours: 2,
      bookingWindowDays: 14,
      now,
      rangeStart,
      rangeEnd,
      busy: [],
      timeZone: "America/New_York",
    });

    // 9am is only 30 minutes away — blocked. 10am is 1.5h — still blocked. None open.
    assert.equal(slots.length, 0);
  });

  it("detects double-booking conflicts including buffer", () => {
    const start = zonedDateTimeToUtc(2026, 11, 9, 10, 0, "America/New_York");
    const end = zonedDateTimeToUtc(2026, 11, 9, 11, 0, "America/New_York");
    assert.equal(
      hasBookingConflict({
        start,
        end,
        bufferMinutes: 15,
        busy: [],
        existingBookings: [
          {
            start: zonedDateTimeToUtc(2026, 11, 9, 11, 0, "America/New_York"),
            end: zonedDateTimeToUtc(2026, 11, 9, 12, 0, "America/New_York"),
          },
        ],
      }),
      true
    );
    assert.equal(
      hasBookingConflict({
        start,
        end,
        bufferMinutes: 0,
        busy: [],
        existingBookings: [
          {
            start: zonedDateTimeToUtc(2026, 11, 9, 11, 0, "America/New_York"),
            end: zonedDateTimeToUtc(2026, 11, 9, 12, 0, "America/New_York"),
          },
        ],
      }),
      false
    );
  });
});
