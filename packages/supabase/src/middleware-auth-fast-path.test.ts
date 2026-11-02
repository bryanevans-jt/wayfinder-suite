import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NextRequest } from "next/server";
import { requestHasSupabaseAuthSessionCookie } from "./auth-session-cookies";
import { tryMiddlewareAnonymousAuthResponse } from "./middleware-auth-fast-path";

describe("requestHasSupabaseAuthSessionCookie", () => {
  it("detects chunked Supabase auth cookies", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://whwetcxrebbuimkozmes.supabase.co";
    assert.equal(
      requestHasSupabaseAuthSessionCookie([
        { name: "sb-whwetcxrebbuimkozmes-auth-token.0" },
      ]),
      true
    );
    assert.equal(requestHasSupabaseAuthSessionCookie([{ name: "other" }]), false);
  });
});

describe("tryMiddlewareAnonymousAuthResponse", () => {
  it("skips Supabase on /login even when session cookies exist", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    const req = new NextRequest("https://pro.example.com/login", {
      headers: {
        cookie: "sb-example-auth-token.0=abc",
      },
    });
    const res = tryMiddlewareAnonymousAuthResponse(req, { app: "staff" });
    assert.ok(res);
    assert.equal(res.status, 200);
  });

  it("redirects unauthenticated dashboard requests without session cookies", () => {
    const req = new NextRequest("https://pro.example.com/dashboard/admin");
    const res = tryMiddlewareAnonymousAuthResponse(req, { app: "staff" });
    assert.ok(res);
    assert.equal(res.status, 307);
    assert.equal(res.headers.get("location"), "https://pro.example.com/login");
  });
});
