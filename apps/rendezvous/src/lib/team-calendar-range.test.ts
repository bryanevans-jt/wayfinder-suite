import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import { dateKeyInTimeZone } from "./scheduling/slots";
import {
  easternCivilParts,
  rangeForViewInEastern,
  shiftEasternDays,
} from "./team-calendar-range";

describe("rangeForViewInEastern", () => {
  it("day window is Eastern midnight→midnight as UTC (concrete Nov 19 2026 EST)", () => {
    // 2026-11-19 is standard time (EST, UTC−5).
    // An instant that is still Nov 18 evening in Pacific / late UTC must still
    // resolve to the Eastern civil day the calendar is showing.
    const anchor = new Date("2026-11-19T16:30:00.000Z"); // 11:30 AM ET
    const { from, to } = rangeForViewInEastern(anchor, "day");

    assert.equal(from.toISOString(), "2026-11-19T05:00:00.000Z"); // midnight ET
    assert.equal(to.toISOString(), "2026-11-20T05:00:00.000Z");

    // A Google event at 10:00 AM ET lands at 15:00Z and falls inside the window.
    const tenAmEt = new Date("2026-11-19T15:00:00.000Z");
    assert.ok(tenAmEt >= from && tenAmEt < to);

    // Without ET math, browser-local midnight in UTC would wrongly use
    // 2026-11-19T00:00:00.000Z → 2026-11-20T00:00:00.000Z and drop early-morning ET events.
  });

  it("week window starts Sunday 00:00 Eastern", () => {
    // Thursday Nov 19 2026 ET → week Sun Nov 15 → Sun Nov 22 (EST).
    const anchor = new Date("2026-11-19T16:30:00.000Z");
    const { from, to } = rangeForViewInEastern(anchor, "week");
    assert.equal(from.toISOString(), "2026-11-15T05:00:00.000Z");
    assert.equal(to.toISOString(), "2026-11-22T05:00:00.000Z");
  });

  it("easternCivilParts ignores browser-local getters", () => {
    // 4am UTC on Nov 20 is still Nov 19 evening in Eastern.
    const lateEt = new Date("2026-11-20T04:00:00.000Z");
    assert.deepEqual(easternCivilParts(lateEt), {
      year: 2026,
      month: 11,
      day: 19,
    });
    assert.equal(dateKeyInTimeZone(lateEt, PORTAL_DISPLAY_TIME_ZONE), "2026-11-19");
  });

  it("shiftEasternDays moves by Eastern civil date", () => {
    const anchor = new Date("2026-11-19T16:30:00.000Z");
    const next = shiftEasternDays(anchor, 1);
    assert.equal(dateKeyInTimeZone(next, PORTAL_DISPLAY_TIME_ZONE), "2026-11-20");
  });
});
