import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldSendReferralCounselorConfirmationEmail } from "./referral-email-policy";

describe("referral counselor confirmation email policy", () => {
  it("defaults on unless explicitly disabled", () => {
    delete process.env.REFERRAL_SEND_COUNSELOR_CONFIRMATION;
    assert.equal(shouldSendReferralCounselorConfirmationEmail(), true);

    process.env.REFERRAL_SEND_COUNSELOR_CONFIRMATION = "false";
    assert.equal(shouldSendReferralCounselorConfirmationEmail(), false);

    process.env.REFERRAL_SEND_COUNSELOR_CONFIRMATION = "true";
    assert.equal(shouldSendReferralCounselorConfirmationEmail(), true);
  });
});
