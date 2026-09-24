import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientBelongsInReferralQueue } from "./referral-intake";

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
