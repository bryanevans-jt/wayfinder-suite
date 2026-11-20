import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrgMonthlyBillableHoursRows,
  classifyOrgBillableLogger,
  countsTowardBillableHoursTotals,
  formatOrgBillableStaffLabel,
} from "./org-billable-hours-rollup";

describe("classifyOrgBillableLogger", () => {
  it("marks live roster as active", () => {
    assert.equal(
      classifyOrgBillableLogger({ onLiveRoster: true, role: "es", isActive: true }),
      "active"
    );
  });

  it("marks deactivated staff as former", () => {
    assert.equal(
      classifyOrgBillableLogger({ onLiveRoster: false, role: "es", isActive: false }),
      "former"
    );
  });

  it("marks non-staff assignees as needs_review", () => {
    assert.equal(
      classifyOrgBillableLogger({ onLiveRoster: false, role: "client", isActive: true }),
      "needs_review"
    );
  });
});

describe("buildOrgMonthlyBillableHoursRows", () => {
  it("keeps deactivated team member hours in a past month and lists zero-hour live roster", () => {
    const formerMinutes = Math.round(133.57 * 60);
    const minutesByUserId = new Map<string, number>([
      ["active-es", 60],
      ["former-es", formerMinutes],
    ]);

    const rows = buildOrgMonthlyBillableHoursRows({
      liveRoster: [
        { id: "active-es", name: "Active ES" },
        { id: "zero-es", name: "Zero Hours ES" },
      ],
      minutesByUserId,
      profileById: new Map([
        ["active-es", { role: "es", isActive: true, displayName: "Active ES" }],
        ["former-es", { role: "es", isActive: false, displayName: "Niki Spivey" }],
        ["zero-es", { role: "es", isActive: true, displayName: "Zero Hours ES" }],
      ]),
    });

    const byId = new Map(rows.map((r) => [r.staffUserId, r]));
    assert.equal(byId.get("former-es")?.rosterStatus, "former");
    assert.equal(byId.get("former-es")?.billableMinutes, formerMinutes);
    assert.match(byId.get("former-es")?.staffName ?? "", /Former/);
    assert.equal(byId.get("zero-es")?.billableMinutes, 0);
    assert.equal(byId.get("active-es")?.rosterStatus, "active");
    assert.equal(
      rows.reduce((s, r) => s + r.billableMinutes, 0),
      60 + formerMinutes
    );
  });

  it("surfaces non-staff allowance loggers as unassigned / needs review", () => {
    const rows = buildOrgMonthlyBillableHoursRows({
      liveRoster: [{ id: "active-es", name: "Active ES" }],
      minutesByUserId: new Map([["client-profile", 480]]),
      profileById: new Map([
        ["active-es", { role: "es", isActive: true, displayName: "Active ES" }],
        ["client-profile", { role: "client", isActive: true, displayName: "" }],
      ]),
    });

    const orphan = rows.find((r) => r.staffUserId === "client-profile");
    assert.ok(orphan);
    assert.equal(orphan?.rosterStatus, "needs_review");
    assert.equal(orphan?.staffName, "Unassigned / needs review");
    assert.equal(orphan?.billableHours, "8.0");
  });
});

describe("formatOrgBillableStaffLabel", () => {
  it("labels former and needs-review rows", () => {
    assert.equal(formatOrgBillableStaffLabel("Ada", "former"), "Ada (Former)");
    assert.equal(
      formatOrgBillableStaffLabel("", "needs_review"),
      "Unassigned / needs review"
    );
  });
});

describe("countsTowardBillableHoursTotals", () => {
  it("excludes demo clients from billable-hours totals", () => {
    assert.equal(
      countsTowardBillableHoursTotals({ clientId: "demo-1", clientIsDemo: true }),
      false
    );
  });

  it("includes production clients and entries with no client", () => {
    assert.equal(
      countsTowardBillableHoursTotals({ clientId: "prod-1", clientIsDemo: false }),
      true
    );
    assert.equal(
      countsTowardBillableHoursTotals({ clientId: "prod-1", clientIsDemo: null }),
      true
    );
    assert.equal(countsTowardBillableHoursTotals({ clientId: null }), true);
    assert.equal(countsTowardBillableHoursTotals({ clientId: undefined }), true);
  });
});
