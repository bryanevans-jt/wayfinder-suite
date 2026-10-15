import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hashReusableSignInToken,
  reusableSignInTtlDays,
} from "./reusable-signin-token";

describe("reusable sign-in token helpers", () => {
  it("hashes tokens deterministically", () => {
    const a = hashReusableSignInToken("test-token");
    const b = hashReusableSignInToken("test-token");
    assert.equal(a, b);
    assert.notEqual(a, hashReusableSignInToken("other"));
  });

  it("defaults TTL to 7 days and caps at 30", () => {
    delete process.env.STAFF_REUSABLE_SIGNIN_DAYS;
    assert.equal(reusableSignInTtlDays(), 7);
    process.env.STAFF_REUSABLE_SIGNIN_DAYS = "14";
    assert.equal(reusableSignInTtlDays(), 14);
    process.env.STAFF_REUSABLE_SIGNIN_DAYS = "90";
    assert.equal(reusableSignInTtlDays(), 30);
  });
});
