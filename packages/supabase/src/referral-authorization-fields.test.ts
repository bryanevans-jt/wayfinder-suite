import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTHORIZED_HOURS_SERVICE_NAMES,
  canEditClientAuthorizedHoursFields,
  canViewClientAuthorizedHoursFields,
  parseAuthorizationEndDate,
  parseAuthorizedHours,
  serviceSupportsAuthorizedHoursFields,
} from "./referral-authorization-fields";

describe("serviceSupportsAuthorizedHoursFields", () => {
  it("matches every production WRT / IJP / Job Coaching catalog variant", () => {
    // Observed on Wayfinder-Production services table.
    assert.equal(serviceSupportsAuthorizedHoursFields("Individual Job Placement (GA)"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("Individual Job Placement"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("Job Coaching (GA)"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("Job Coaching"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("Workplace Readiness Training (GA)"), true);
  });

  it("matches referral form labels and abbreviations", () => {
    assert.equal(serviceSupportsAuthorizedHoursFields("Workplace Readiness Training"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("IJP"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("WRT"), true);
    assert.equal(serviceSupportsAuthorizedHoursFields("Individual Job Placement (IJP)"), true);
  });

  it("covers the AUTHORIZED_HOURS_SERVICE_NAMES constant list", () => {
    for (const name of AUTHORIZED_HOURS_SERVICE_NAMES) {
      assert.equal(
        serviceSupportsAuthorizedHoursFields(name),
        true,
        `expected support for ${name}`
      );
    }
  });

  it("excludes other services and empty values", () => {
    assert.equal(
      serviceSupportsAuthorizedHoursFields("Traditional Supported Employment (GA)"),
      false
    );
    assert.equal(serviceSupportsAuthorizedHoursFields("Supported Employment"), false);
    assert.equal(serviceSupportsAuthorizedHoursFields(null), false);
    assert.equal(serviceSupportsAuthorizedHoursFields(""), false);
  });
});

describe("parseAuthorizedHours", () => {
  it("allows empty optional values", () => {
    assert.deepEqual(parseAuthorizedHours(null), { ok: true, value: null });
    assert.deepEqual(parseAuthorizedHours(""), { ok: true, value: null });
    assert.deepEqual(parseAuthorizedHours("  "), { ok: true, value: null });
    assert.deepEqual(parseAuthorizedHours(undefined), { ok: true, value: null });
  });

  it("accepts non-negative numbers", () => {
    assert.deepEqual(parseAuthorizedHours(0), { ok: true, value: 0 });
    assert.deepEqual(parseAuthorizedHours("12.5"), { ok: true, value: 12.5 });
    assert.deepEqual(parseAuthorizedHours(40), { ok: true, value: 40 });
  });

  it("rejects negatives and non-numeric input", () => {
    assert.equal(parseAuthorizedHours(-1).ok, false);
    assert.equal(parseAuthorizedHours("-3").ok, false);
    assert.equal(parseAuthorizedHours("abc").ok, false);
    assert.equal(parseAuthorizedHours(Number.NaN).ok, false);
  });
});

describe("parseAuthorizationEndDate", () => {
  it("allows empty optional values", () => {
    assert.deepEqual(parseAuthorizationEndDate(null), { ok: true, value: null });
    assert.deepEqual(parseAuthorizationEndDate(""), { ok: true, value: null });
    assert.deepEqual(parseAuthorizationEndDate("  "), { ok: true, value: null });
  });

  it("accepts valid ISO dates", () => {
    assert.deepEqual(parseAuthorizationEndDate("2026-12-31"), {
      ok: true,
      value: "2026-12-31",
    });
  });

  it("rejects invalid dates", () => {
    assert.equal(parseAuthorizationEndDate("12/31/2026").ok, false);
    assert.equal(parseAuthorizationEndDate("2026-13-01").ok, false);
    assert.equal(parseAuthorizationEndDate("2026-02-30").ok, false);
    assert.equal(parseAuthorizationEndDate("not-a-date").ok, false);
  });
});

describe("authorized hours field permissions", () => {
  it("lets assigned ES/TS roles view and edit (assignment checked at API)", () => {
    assert.equal(canViewClientAuthorizedHoursFields("es"), true);
    assert.equal(canViewClientAuthorizedHoursFields("transition_specialist"), true);
    assert.equal(canEditClientAuthorizedHoursFields("es"), true);
    assert.equal(canEditClientAuthorizedHoursFields("transition_specialist"), true);
  });

  it("lets referral managers and profile viewers see; accountants view-only", () => {
    assert.equal(canViewClientAuthorizedHoursFields("hr"), true);
    assert.equal(canViewClientAuthorizedHoursFields("admin"), true);
    assert.equal(canViewClientAuthorizedHoursFields("super_admin"), true);
    assert.equal(canViewClientAuthorizedHoursFields("accountant"), true);
    assert.equal(canViewClientAuthorizedHoursFields("hospitality_specialist"), true);

    assert.equal(canEditClientAuthorizedHoursFields("hr"), true);
    assert.equal(canEditClientAuthorizedHoursFields("admin"), true);
    assert.equal(canEditClientAuthorizedHoursFields("accountant"), false);
  });

  it("denies counselors and unrelated roles", () => {
    assert.equal(canViewClientAuthorizedHoursFields("counselor"), false);
    assert.equal(canEditClientAuthorizedHoursFields("counselor"), false);
    assert.equal(canViewClientAuthorizedHoursFields("client"), false);
    assert.equal(canEditClientAuthorizedHoursFields(null), false);
  });
});
