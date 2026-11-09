import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hashBookingToken, issueBookingToken, tokensMatch } from "./tokens";

describe("booking tokens", () => {
  it("hashes stably and verifies", () => {
    const { token, hash } = issueBookingToken();
    assert.equal(hashBookingToken(token), hash);
    assert.equal(tokensMatch(token, hash), true);
    assert.equal(tokensMatch("nope", hash), false);
  });
});
