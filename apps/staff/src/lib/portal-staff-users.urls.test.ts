import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("staff magic link URLs", () => {
  it("uses confirm landing before callback", async () => {
    process.env.NEXT_PUBLIC_STAFF_APP_URL = "https://pro.example.com/";
    const { staffMagicLinkConfirmUrl, staffInviteRedirectUrl } = await import(
      "./portal-staff-users"
    );
    assert.equal(staffMagicLinkConfirmUrl(), "https://pro.example.com/auth/confirm");
    assert.equal(staffInviteRedirectUrl(), "https://pro.example.com/auth/callback");
  });
});
