import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildKraSummaryPayload,
  careersKraSecretsEqual,
  isKraMonthMet,
  kraSummaryRateLimited,
  normalizeKraSummaryEmail,
  parseQuarterKey,
  resetKraSummaryRateLimitForTests,
  staffRowToMonthSummary,
} from "./kra-summary";

describe("kra-summary secret check", () => {
  it("accepts equal secrets", () => {
    assert.equal(careersKraSecretsEqual("shared-secret", "shared-secret"), true);
  });

  it("rejects wrong or empty secrets", () => {
    assert.equal(careersKraSecretsEqual("wrong", "shared-secret"), false);
    assert.equal(careersKraSecretsEqual("", "shared-secret"), false);
    assert.equal(careersKraSecretsEqual("shared-secret", ""), false);
  });
});

describe("kra-summary quarter parsing", () => {
  it("parses YYYY-Qn into three month keys", () => {
    assert.deepEqual(parseQuarterKey("2026-Q1"), {
      quarter: "2026-Q1",
      monthKeys: ["2026-01", "2026-02", "2026-03"],
    });
    assert.deepEqual(parseQuarterKey("2026-q4"), {
      quarter: "2026-Q4",
      monthKeys: ["2026-10", "2026-11", "2026-12"],
    });
  });

  it("rejects invalid quarter strings", () => {
    assert.equal(parseQuarterKey("2026-Q5"), null);
    assert.equal(parseQuarterKey("2026-01"), null);
    assert.equal(parseQuarterKey(""), null);
    assert.equal(parseQuarterKey(null), null);
  });

  it("normalizes emails", () => {
    assert.equal(normalizeKraSummaryEmail("  Alex@TheJoshuaTree.org "), "alex@thejoshuatree.org");
    assert.equal(normalizeKraSummaryEmail("not-an-email"), null);
  });
});

describe("kra-summary response shape", () => {
  it("builds Careers contract summary with monthsMet = 100% in-scope months", () => {
    const months = [
      staffRowToMonthSummary("2026-01", "January 2026", true, {
        metCount: 4,
        missedCount: 1,
        inScopeClientCount: 5,
        complianceLabel: "4 / 5",
        averageBillableHoursPerClient: "3.2",
      }),
      staffRowToMonthSummary("2026-02", "February 2026", true, {
        metCount: 5,
        missedCount: 0,
        inScopeClientCount: 5,
        complianceLabel: "5 / 5",
        averageBillableHoursPerClient: "3.0",
      }),
      staffRowToMonthSummary("2026-03", "March 2026", false, {
        metCount: 3,
        missedCount: 2,
        inScopeClientCount: 5,
        complianceLabel: "3 / 5",
        averageBillableHoursPerClient: "3.1",
      }),
    ];

    assert.equal(isKraMonthMet(months[0]!), false);
    assert.equal(isKraMonthMet(months[1]!), true);
    assert.equal(isKraMonthMet({ metCount: 0, inScopeClientCount: 0 }), false);

    const payload = buildKraSummaryPayload("alex@thejoshuatree.org", "2026-Q1", months);

    assert.equal(payload.email, "alex@thejoshuatree.org");
    assert.equal(payload.quarter, "2026-Q1");
    assert.equal(payload.months.length, 3);
    assert.deepEqual(Object.keys(payload.months[0]!).sort(), [
      "averageBillableHoursPerClient",
      "complianceLabel",
      "frozen",
      "inScopeClientCount",
      "metCount",
      "missedCount",
      "monthKey",
      "monthLabel",
    ]);
    assert.equal(payload.summary.monthsMet, 1);
    assert.equal(payload.summary.monthsTotal, 3);
    assert.equal(payload.summary.metCount, 12);
    assert.equal(payload.summary.inScopeClientCount, 15);
    assert.equal(payload.summary.complianceLabel, "12 / 15");
    assert.equal(payload.summary.averageBillableHoursPerClient, "3.1");
    // Aggregate-only: no client arrays leaked into months.
    assert.equal("clients" in payload.months[0]!, false);
  });

  it("rate-limits after 30 hits in a window", () => {
    resetKraSummaryRateLimitForTests();
    const start = 5_000_000;
    for (let i = 0; i < 30; i++) {
      assert.equal(kraSummaryRateLimited("ip-a", start + i), false);
    }
    assert.equal(kraSummaryRateLimited("ip-a", start + 30), true);
    assert.equal(kraSummaryRateLimited("ip-b", start + 30), false);
  });
});
