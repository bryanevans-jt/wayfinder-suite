import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTH_WARNING_APPROACHING_BUFFER_IJP_HOURS,
  AUTH_WARNING_APPROACHING_BUFFER_OTHER_HOURS,
  AUTH_WARNING_EARLY_BUFFER_HOURS,
  authorizationFingerprint,
  authorizationHoursThresholds,
  authorizationWarningListLabel,
  evaluateAuthorizationWarnings,
} from "./authorization-warnings-shared";
import { sumAuthorizationBilledHoursFromEntries } from "./authorization-warnings";

describe("authorizationHoursThresholds", () => {
  it("uses authorized-5 early and authorized-2 approaching for all IJP variants", () => {
    for (const name of [
      "Individual Job Placement",
      "Individual Job Placement (GA)",
      "IJP",
    ]) {
      const t = authorizationHoursThresholds(15, name);
      assert.equal(t.isIjp, true);
      assert.equal(t.earlyAt, 15 - AUTH_WARNING_EARLY_BUFFER_HOURS);
      assert.equal(t.approachingAt, 15 - AUTH_WARNING_APPROACHING_BUFFER_IJP_HOURS);
      assert.equal(t.exceededAbove, 15);
      assert.equal(t.earlyAt, 10);
      assert.equal(t.approachingAt, 13);
    }
  });

  it("uses authorized-5 early and authorized-1 approaching for WRT and Job Coaching", () => {
    for (const name of [
      "Workplace Readiness Training (GA)",
      "Workplace Readiness Training",
      "Job Coaching (GA)",
      "Job Coaching",
    ]) {
      const t = authorizationHoursThresholds(15, name);
      assert.equal(t.isIjp, false);
      assert.equal(t.earlyAt, 10);
      assert.equal(t.approachingAt, 15 - AUTH_WARNING_APPROACHING_BUFFER_OTHER_HOURS);
      assert.equal(t.approachingAt, 14);
    }
  });
});

describe("evaluateAuthorizationWarnings", () => {
  it("shows NO warnings and treats as not applicable when authorized_hours is null (including end date)", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: null,
      authorizationEndDate: "2020-01-01",
      billedHours: 100,
      serviceName: "Individual Job Placement (GA)",
      todayYmd: "2026-11-13",
    });
    assert.equal(result.applicable, false);
    assert.equal(result.hoursLevel, null);
    assert.equal(result.endDatePassed, false);
    assert.deepEqual(result.activeKinds, []);
    assert.equal(result.fingerprint, null);
    assert.equal(authorizationWarningListLabel(result), null);
  });

  it("shows NO warnings when authorized_hours is null even with zero billed hours", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: null,
      authorizationEndDate: "2026-12-01",
      billedHours: 0,
      serviceName: "Workplace Readiness Training (GA)",
      todayYmd: "2026-11-13",
    });
    assert.equal(result.applicable, false);
    assert.deepEqual(result.activeKinds, []);
  });

  it("matches Bryan's IJP example: 15 auth → early at 10, approaching at 13, exceeded above 15", () => {
    const base = {
      authorizedHours: 15,
      authorizationEndDate: null as string | null,
      serviceName: "Individual Job Placement (GA)",
      todayYmd: "2026-11-13",
    };
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 9 }).hoursLevel,
      null
    );
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 10 }).hoursLevel,
      "early"
    );
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 12.5 }).hoursLevel,
      "early"
    );
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 13 }).hoursLevel,
      "approaching"
    );
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 15 }).hoursLevel,
      "approaching"
    );
    assert.equal(
      evaluateAuthorizationWarnings({ ...base, billedHours: 15.5 }).hoursLevel,
      "exceeded"
    );
  });

  it("uses WRT/Job Coaching approaching at authorized - 1", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: 15,
      billedHours: 14,
      serviceName: "Job Coaching",
      todayYmd: "2026-11-13",
    });
    assert.equal(result.hoursLevel, "approaching");
    assert.deepEqual(result.activeKinds, ["approaching"]);
  });

  it("flags end date passed on America/New_York calendar date when hours are set", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: 20,
      authorizationEndDate: "2026-11-12",
      billedHours: 1,
      serviceName: "Workplace Readiness Training (GA)",
      todayYmd: "2026-11-13",
    });
    assert.equal(result.endDatePassed, true);
    assert.ok(result.activeKinds.includes("end_date_passed"));
  });

  it("does not flag end date on the end date itself", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: 20,
      authorizationEndDate: "2026-11-13",
      billedHours: 1,
      serviceName: "IJP",
      todayYmd: "2026-11-13",
    });
    assert.equal(result.endDatePassed, false);
  });

  it("skips early/approaching when thresholds are not positive", () => {
    const result = evaluateAuthorizationWarnings({
      authorizedHours: 3,
      billedHours: 2,
      serviceName: "Individual Job Placement",
      todayYmd: "2026-11-13",
    });
    // earlyAt = -2, approachingAt = 1 → approaching when billed >= 1
    assert.equal(result.hoursLevel, "approaching");
  });

  it("changes fingerprint when authorized hours or end date change", () => {
    assert.notEqual(
      authorizationFingerprint(15, "2026-12-01"),
      authorizationFingerprint(20, "2026-12-01")
    );
    assert.notEqual(
      authorizationFingerprint(15, "2026-12-01"),
      authorizationFingerprint(15, "2026-12-02")
    );
    assert.equal(
      authorizationFingerprint(15, null),
      authorizationFingerprint(15, "")
    );
  });
});

describe("sumAuthorizationBilledHoursFromEntries", () => {
  it("sums half-hour-rounded billable lines and includes GVRA allowance", () => {
    const hours = sumAuthorizationBilledHoursFromEntries([
      {
        duration_minutes: 75, // 1.5
        service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
      },
      {
        duration_minutes: 120, // 2.0 GVRA
        flags: { gvra_monthly_admin_allowance: true },
        service_activity_types: { code: "JT-CSE-051", counts_toward_client_billable: true },
      },
      {
        duration_minutes: 60,
        status: "rejected",
        service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
      },
      {
        duration_minutes: 30,
        counts_toward_client_billable: false,
        service_activity_types: { code: "JT-ACT-099", counts_toward_client_billable: false },
      },
    ]);
    assert.equal(hours, 3.5);
  });
});
