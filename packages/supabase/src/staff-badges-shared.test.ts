import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AssignmentEventRow } from "./es-client-assignment-events";
import {
  ASSIGNMENT_HISTORY_BACKFILL_DAY,
  assigneeOnCalendarDate,
  clientHasNoFourteenDayGap,
  computeMonthStreaks,
  countPlacementsInMonth,
  creditPlacementToStaff,
  everyClientContactedInMonth,
  isNewPersonalBest,
  kraTiersEarned,
  noFourteenDayGapsInMonth,
  placementTiersEarned,
  STAFF_BADGE_MIN_CLIENTS,
} from "./staff-badges-shared";

describe("staff badge thresholds", () => {
  it("requires 3 in-scope clients for KRA percent badges", () => {
    assert.deepEqual(kraTiersEarned(2, 2), []);
    assert.deepEqual(kraTiersEarned(1, 3), []);
    assert.deepEqual(kraTiersEarned(2, 3), [50]);
    assert.deepEqual(kraTiersEarned(3, 4), [50, 75]);
    assert.deepEqual(kraTiersEarned(3, 3), [50, 75, 100]);
  });

  it("awards placement month tiers at 1/2/3", () => {
    assert.deepEqual(placementTiersEarned(0), []);
    assert.deepEqual(placementTiersEarned(1), [1]);
    assert.deepEqual(placementTiersEarned(2), [1, 2]);
    assert.deepEqual(placementTiersEarned(5), [1, 2, 3]);
  });

  it("requires 3 clients for every-contacted and no-gap badges", () => {
    assert.equal(STAFF_BADGE_MIN_CLIENTS, 3);
    assert.equal(
      everyClientContactedInMonth({
        caseloadClientIds: ["a", "b"],
        contactedClientIds: new Set(["a", "b"]),
      }),
      false
    );
    assert.equal(
      everyClientContactedInMonth({
        caseloadClientIds: ["a", "b", "c"],
        contactedClientIds: new Set(["a", "b", "c"]),
      }),
      true
    );
    assert.equal(
      noFourteenDayGapsInMonth({
        caseloadClientIds: ["a", "b"],
        contactYmdsByClient: new Map([
          ["a", ["2026-11-01", "2026-11-10", "2026-11-20"]],
          ["b", ["2026-11-01", "2026-11-10", "2026-11-20"]],
        ]),
        windowStart: "2026-11-01",
        windowEnd: "2026-11-20",
      }),
      false
    );
  });
});

describe("placement credit on job_start_date", () => {
  const events: AssignmentEventRow[] = [
    {
      client_id: "c1",
      es_user_id: "es-early",
      effective_at: "2025-01-01T12:00:00.000Z",
    },
    {
      client_id: "c1",
      es_user_id: "es-late",
      effective_at: "2026-08-01T12:00:00.000Z",
    },
  ];

  it("uses earliest known assignee before backfill day", () => {
    assert.ok("2026-06-15" < ASSIGNMENT_HISTORY_BACKFILL_DAY);
    assert.equal(assigneeOnCalendarDate(events, "2026-06-15"), "es-early");
    assert.equal(creditPlacementToStaff(events, "2026-06-15", "es-early"), true);
    assert.equal(creditPlacementToStaff(events, "2026-06-15", "es-late"), false);
  });

  it("uses assignee covering the job start on/after backfill day", () => {
    assert.equal(assigneeOnCalendarDate(events, "2026-09-10"), "es-late");
    assert.equal(creditPlacementToStaff(events, "2026-09-10", "es-late"), true);
    assert.equal(creditPlacementToStaff(events, "2026-09-10", "es-early"), false);
  });

  it("counts placements only for the credited specialist in-month", () => {
    const eventsByClient = new Map([["c1", events]]);
    const jobStarts = new Map([["c1", "2026-09-10"]]);
    assert.equal(
      countPlacementsInMonth({
        staffUserId: "es-late",
        monthKey: "2026-09",
        jobStarts,
        eventsByClient,
      }),
      1
    );
    assert.equal(
      countPlacementsInMonth({
        staffUserId: "es-early",
        monthKey: "2026-09",
        jobStarts,
        eventsByClient,
      }),
      0
    );
  });
});

describe("14-day gap and streaks", () => {
  it("flags a 14+ day gap and accepts tighter contact cadence", () => {
    assert.equal(
      clientHasNoFourteenDayGap({
        contactYmds: ["2026-11-01", "2026-11-20"],
        windowStart: "2026-11-01",
        windowEnd: "2026-11-30",
      }),
      false
    );
    assert.equal(
      clientHasNoFourteenDayGap({
        contactYmds: ["2026-11-01", "2026-11-10", "2026-11-20", "2026-11-30"],
        windowStart: "2026-11-01",
        windowEnd: "2026-11-30",
      }),
      true
    );
  });

  it("computes current and best streaks without exposing a break narrative", () => {
    const earned = ["2026-01", "2026-02", "2026-03", "2026-05", "2026-06"];
    assert.deepEqual(computeMonthStreaks(earned, "2026-06"), { current: 2, best: 3 });
    assert.deepEqual(computeMonthStreaks(earned, "2026-04"), { current: 0, best: 3 });
  });

  it("detects personal best months", () => {
    assert.equal(isNewPersonalBest(2, []), true);
    assert.equal(isNewPersonalBest(2, [1, 2]), false);
    assert.equal(isNewPersonalBest(3, [1, 2]), true);
    assert.equal(isNewPersonalBest(0, [1]), false);
  });
});
