import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { redirectStrayEmailAuthParams } from "./middleware-app";

describe("redirectStrayEmailAuthParams", () => {
  it("sends root magic-link query params to staff confirm", () => {
    const req = new NextRequest(
      "https://pro.example.com/?token_hash=abc123&type=magiclink"
    );
    const res = redirectStrayEmailAuthParams(req, { app: "staff" });
    assert.ok(res);
    assert.equal(res.status, 307);
    const loc = res.headers.get("location");
    assert.ok(loc?.includes("/auth/confirm"));
    assert.ok(loc?.includes("token_hash=abc123"));
    assert.ok(loc?.includes("type=magiclink"));
  });

  it("ignores requests already on auth callback", () => {
    const req = new NextRequest(
      "https://pro.example.com/auth/callback?token_hash=abc&type=magiclink"
    );
    assert.equal(redirectStrayEmailAuthParams(req, { app: "staff" }), null);
  });
});
