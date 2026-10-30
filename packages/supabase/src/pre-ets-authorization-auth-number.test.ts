import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validatePreEtsAuthorizationNumberForRoster } from "./pre-ets-authorization-auth-number";

describe("validatePreEtsAuthorizationNumberForRoster", () => {
  const groupDigits = 8;

  it("rejects empty authorization numbers", () => {
    assert.deepEqual(validatePreEtsAuthorizationNumberForRoster("", 1, groupDigits), {
      ok: false,
      error: "Authorization number is required.",
    });
  });

  it("accepts group auth with multiple students", () => {
    assert.deepEqual(validatePreEtsAuthorizationNumberForRoster("12345678", 5, groupDigits), {
      ok: true,
      authType: "group",
    });
  });

  it("rejects individual auth when roster has more than one student", () => {
    const result = validatePreEtsAuthorizationNumberForRoster("123456789012", 2, groupDigits);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /Individual authorizations/);
    }
  });
});
