import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  sumBillableMinutesFromTimeEntryRows,
} from "./client-billable";
import { expectedBillableMinutesForClients } from "./kra-billable-expected";
import {
  KRA_GVRA_SERVICE_NAMES,
  serviceIdsInKraScope,
  thresholdHoursForService,
  type KraBillableSettingsRow,
} from "./kra-billable-settings";
import {
  buildKraUncountedHoursBreakdown,
  classifyPayrollEntryForKra,
} from "./kra-uncounted-hours";

const IJP_ID = "svc-ijp";
const TSE_ID = "svc-tse";
const WRT_ID = "svc-wrt";
const JOB_COACHING_ID = "svc-job-coaching";

const settings: KraBillableSettingsRow = {
  id: "settings-1",
  count_system_allowance_toward_kra: true,
  successor_inherits_client_month_hours: true,
  rules: [
    {
      service_ids: [IJP_ID, TSE_ID],
      hours_per_client_per_month: 10,
    },
  ],
  updated_at: "2026-11-01T00:00:00.000Z",
  updated_by: null,
};

describe("payroll vs KRA service scope", () => {
  it("KRA settings cover IJP/TSE only — not WRT or Job Coaching", () => {
    const scope = serviceIdsInKraScope(settings);
    assert.equal(scope.has(IJP_ID), true);
    assert.equal(scope.has(TSE_ID), true);
    assert.equal(scope.has(WRT_ID), false);
    assert.equal(scope.has(JOB_COACHING_ID), false);
    assert.equal(thresholdHoursForService(settings, WRT_ID), null);
    assert.equal(thresholdHoursForService(settings, JOB_COACHING_ID), null);
    assert.ok(!KRA_GVRA_SERVICE_NAMES.some((n) => /WRT|Workplace Readiness|Job Coaching/i.test(n)));
  });

  it("counts WRT and Job Coaching in payroll actuals but not in the KRA unique pool or expected hours", () => {
    const ijpEntry = {
      duration_minutes: 120,
      flags: {},
      service_activity_types: { code: "JT-ACT-010", counts_toward_client_billable: true },
    };
    const wrtEntry = {
      duration_minutes: 90,
      flags: {},
      service_activity_types: { code: "JT-ACT-010", counts_toward_client_billable: true },
    };
    const jobCoachingEntry = {
      duration_minutes: 60,
      flags: {},
      service_activity_types: { code: "JT-ACT-010", counts_toward_client_billable: true },
    };

    // Payroll org total: all three billable lines count (service line is irrelevant to payroll).
    const payrollMinutes = sumBillableMinutesFromTimeEntryRows([
      ijpEntry,
      wrtEntry,
      jobCoachingEntry,
    ]);
    assert.equal(payrollMinutes, 270);

    const classifications = [
      classifyPayrollEntryForKra({
        billableMinutes: 120,
        clientId: "ijp-client",
        clientInKraScope: true, // IJP
        hasKraRosterAssignee: true,
        hasOnlyFormerStaffAssignees: false,
      }),
      classifyPayrollEntryForKra({
        billableMinutes: 90,
        clientId: "wrt-client",
        clientInKraScope: false, // WRT
        hasKraRosterAssignee: true,
        hasOnlyFormerStaffAssignees: false,
      }),
      classifyPayrollEntryForKra({
        billableMinutes: 60,
        clientId: "jc-client",
        clientInKraScope: false, // Job Coaching
        hasKraRosterAssignee: true,
        hasOnlyFormerStaffAssignees: false,
      }),
    ];

    const breakdown = buildKraUncountedHoursBreakdown(classifications);
    assert.equal(breakdown.payrollOrgMinutes, 270);
    assert.equal(breakdown.kraUniquePoolMinutes, 120);
    assert.equal(breakdown.uncountedMinutes, 150);
    const outOfScope = breakdown.rows.find((r) => r.reason === "out_of_scope_service");
    assert.ok(outOfScope);
    assert.equal(outOfScope?.billableMinutes, 150);

    // Expected hours stay KRA-scope only (IJP/TSE clients × threshold).
    assert.equal(
      expectedBillableMinutesForClients([{ thresholdHours: 10 }]),
      600
    );
  });
});
