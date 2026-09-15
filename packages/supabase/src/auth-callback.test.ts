import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextResponse } from "next/server";
import { isFailedAuthLoginRedirect } from "./auth-callback";

describe("auth-callback helpers", () => {
  it("detects failed auth login redirects", () => {
    const origin = "https://pro.example.com";
    const response = NextResponse.redirect(new URL("/login?error=auth", origin));
    assert.equal(isFailedAuthLoginRedirect(response, origin), true);

    const ok = NextResponse.redirect(new URL("/dashboard", origin));
    assert.equal(isFailedAuthLoginRedirect(ok, origin), false);
  });
});
