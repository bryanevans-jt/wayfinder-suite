import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { currentMonthKey, defaultPayrollMonthKey } from "./es-time-data";
import { currentServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";

describe("billable month defaults", () => {
  it("defaults oversight and IJP UI to the current Eastern month", () => {
    const now = new Date("2026-11-20T18:00:00.000Z");
    assert.equal(currentMonthKey(now), "2026-11");
    assert.equal(currentServiceMonthStart(now), "2026-11-01");
    // Prior-month helper remains available for payroll cron-style use, but the
    // Billable Hours / IJP pickers default to currentMonthKey / currentServiceMonthStart.
    assert.equal(defaultPayrollMonthKey(now), "2026-10");
  });
});
