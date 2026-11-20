import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBillableMonthWeekBuckets,
  hoursDeltaLabel,
  priorMonthKeyFrom,
} from "./billable-month-comparisons";

describe("priorMonthKeyFrom", () => {
  it("returns the previous calendar month", () => {
    assert.equal(priorMonthKeyFrom("2026-11"), "2026-10");
    assert.equal(priorMonthKeyFrom("2026-01"), "2025-12");
  });
});

describe("buildBillableMonthWeekBuckets", () => {
  it("pages week buckets across a month without truncating entries", () => {
    const entries = Array.from({ length: 1005 }, (_, i) => ({
      service_date: "2026-10-15",
      billableMinutes: 1,
    }));
    const weeks = buildBillableMonthWeekBuckets({
      rangeStart: "2026-10-01",
      rangeEnd: "2026-10-31",
      entries,
    });
    const total = weeks.reduce((s, w) => s + w.billableMinutes, 0);
    assert.equal(total, 1005);
    assert.ok(weeks.length >= 4);
  });
});

describe("hoursDeltaLabel", () => {
  it("reports hour differences, not percentages", () => {
    assert.equal(hoursDeltaLabel(120, 60).deltaHours, "+1.0");
    assert.equal(hoursDeltaLabel(60, 120).deltaHours, "-1.0");
  });
});
