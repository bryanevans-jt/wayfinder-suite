import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS,
  ijpSignatureFlagsDisabledByEnv,
  ijpSignatureFlagsRateLimited,
  resetIjpSignatureFlagsRateLimitForTests,
} from "./ijp-signature-flags-rate-limit";

describe("ijp signature flags rate limit", () => {
  it("allows up to 20 requests per minute then blocks", () => {
    resetIjpSignatureFlagsRateLimitForTests();
    const userId = "user-a";
    const start = 1_000_000;
    for (let i = 0; i < 20; i++) {
      assert.equal(ijpSignatureFlagsRateLimited(userId, start + i), false);
    }
    assert.equal(ijpSignatureFlagsRateLimited(userId, start + 20), true);
  });

  it("isolates users and slides the window", () => {
    resetIjpSignatureFlagsRateLimitForTests();
    const start = 2_000_000;
    for (let i = 0; i < 20; i++) {
      assert.equal(ijpSignatureFlagsRateLimited("u1", start + i), false);
    }
    assert.equal(ijpSignatureFlagsRateLimited("u2", start + 20), false);
    assert.equal(ijpSignatureFlagsRateLimited("u1", start + 60_000), false);
  });

  it("kill switch defaults off (flags enabled)", () => {
    assert.equal(ijpSignatureFlagsDisabledByEnv({}), false);
    assert.equal(ijpSignatureFlagsDisabledByEnv({ IJP_SIGNATURE_FLAGS_DISABLED: "true" }), true);
    assert.equal(ijpSignatureFlagsDisabledByEnv({ IJP_SIGNATURE_FLAGS_DISABLED: "1" }), true);
    assert.equal(IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS, 50);
  });
});
