import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKraUncountedHoursBreakdown,
  classifyPayrollEntryForKra,
} from "./kra-uncounted-hours";

describe("classifyPayrollEntryForKra", () => {
  it("counts in-scope assigned minutes in the unique KRA pool once", () => {
    const row = classifyPayrollEntryForKra({
      billableMinutes: 120,
      clientId: "c1",
      clientInKraScope: true,
      hasKraRosterAssignee: true,
      hasOnlyFormerStaffAssignees: false,
    });
    assert.equal(row.inKraUniquePool, true);
    assert.equal(row.reason, undefined);
  });

  it("labels out-of-scope services and former-only caseloads", () => {
    assert.equal(
      classifyPayrollEntryForKra({
        billableMinutes: 60,
        clientId: "c2",
        clientInKraScope: false,
        hasKraRosterAssignee: false,
        hasOnlyFormerStaffAssignees: false,
      }).reason,
      "out_of_scope_service"
    );
    assert.equal(
      classifyPayrollEntryForKra({
        billableMinutes: 60,
        clientId: "c3",
        clientInKraScope: true,
        hasKraRosterAssignee: false,
        hasOnlyFormerStaffAssignees: true,
      }).reason,
      "former_staff_caseload"
    );
  });
});

describe("buildKraUncountedHoursBreakdown", () => {
  it("reconciles payroll = KRA unique pool + uncounted without double-counting", () => {
    const breakdown = buildKraUncountedHoursBreakdown([
      classifyPayrollEntryForKra({
        billableMinutes: 600,
        clientId: "c1",
        clientInKraScope: true,
        hasKraRosterAssignee: true,
        hasOnlyFormerStaffAssignees: false,
      }),
      classifyPayrollEntryForKra({
        billableMinutes: 120,
        clientId: "c2",
        clientInKraScope: false,
        hasKraRosterAssignee: false,
        hasOnlyFormerStaffAssignees: false,
      }),
      classifyPayrollEntryForKra({
        billableMinutes: 30,
        clientId: null,
        clientInKraScope: false,
        hasKraRosterAssignee: false,
        hasOnlyFormerStaffAssignees: false,
      }),
    ]);
    assert.equal(breakdown.payrollOrgMinutes, 750);
    assert.equal(breakdown.kraUniquePoolMinutes, 600);
    assert.equal(breakdown.uncountedMinutes, 150);
    assert.equal(
      breakdown.kraUniquePoolMinutes + breakdown.uncountedMinutes,
      breakdown.payrollOrgMinutes
    );
  });
});
