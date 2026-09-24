import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientBelongsInReferralQueue,
  normalizedClientIntakeStatus,
} from "./referral-intake";

describe("normalizedClientIntakeStatus", () => {
  it("treats null/empty as active", () => {
    assert.equal(normalizedClientIntakeStatus(null), "active");
    assert.equal(normalizedClientIntakeStatus(""), "active");
  });
});

describe("clientBelongsInReferralQueue", () => {
  it("includes open pipeline statuses", () => {
    assert.equal(clientBelongsInReferralQueue("new_referral", null, { includeActive: false }), true);
    assert.equal(
      clientBelongsInReferralQueue("pending_authorization", null, { includeActive: false }),
      true
    );
  });

  it("excludes legacy active roster without referred_at even when includeActive", () => {
    assert.equal(clientBelongsInReferralQueue("active", null, { includeActive: true }), false);
  });

  it("includes active with authorization when includeActive", () => {
    assert.equal(
      clientBelongsInReferralQueue("active", null, {
        includeActive: true,
        authorizationNumber: "AUTH-123",
      }),
      true
    );
  });

  it("includes active with ES assignment when includeActive", () => {
    assert.equal(
      clientBelongsInReferralQueue("active", null, {
        includeActive: true,
        hasEsAssignment: true,
      }),
      true
    );
  });

  it("includes ES-assigned clients even without referral timestamps when includeActive", () => {
    assert.equal(
      clientBelongsInReferralQueue("active", null, {
        includeActive: true,
        hasEsAssignment: true,
        authorizationNumber: null,
      }),
      true
    );
  });

  it("excludes archived clients", () => {
    assert.equal(
      clientBelongsInReferralQueue("new_referral", null, {
        includeActive: false,
        archivedAt: "2026-01-01T00:00:00.000Z",
      }),
      false
    );
  });

  it("includes activated referrals with referred_at when includeActive", () => {
    assert.equal(
      clientBelongsInReferralQueue("active", "2026-09-24T12:00:00.000Z", { includeActive: true }),
      true
    );
  });

  it("excludes discarded", () => {
    assert.equal(
      clientBelongsInReferralQueue("discarded", "2026-09-24T12:00:00.000Z", { includeActive: true }),
      false
    );
  });
});
