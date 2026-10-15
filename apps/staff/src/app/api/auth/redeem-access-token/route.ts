import { finishStaffSignInAfterAuth } from "@/lib/finish-staff-sign-in";
import { mintStaffSessionCookiesForEmail } from "@/lib/staff-session-mint";
import { type SupabaseCookieToSet } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { resolveReusableSignInToken } from "@wayfinder/supabase/reusable-signin-token";
import { NextResponse } from "next/server";

function loginRedirect(origin: string, error: string, reason?: string) {
  const url = new URL("/login", origin);
  url.searchParams.set("error", error);
  if (reason) url.searchParams.set("reason", reason.slice(0, 240));
  return NextResponse.redirect(url);
}

function applyCookies(response: NextResponse, sessionCookies: SupabaseCookieToSet[]) {
  sessionCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  let plainToken = "";

  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json()) as { token?: string };
    plainToken = (body.token ?? "").trim();
  } else {
    const form = await request.formData();
    plainToken = (form.get("token")?.toString() ?? "").trim();
  }

  if (!plainToken) {
    return loginRedirect(origin, "auth", "missing_access_token");
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return loginRedirect(origin, "auth", "server_configuration");
  }

  const resolved = await resolveReusableSignInToken(admin, plainToken);
  if (!resolved) {
    return loginRedirect(
      origin,
      "auth",
      "This sign-in link is invalid or expired. Request a new one from the login page."
    );
  }

  const minted = await mintStaffSessionCookiesForEmail(admin, resolved.email);
  if ("error" in minted) {
    return loginRedirect(origin, "auth", "link_expired");
  }

  if (minted.userId !== resolved.authUserId) {
    return loginRedirect(origin, "auth", "link_expired");
  }

  const finished = await finishStaffSignInAfterAuth(admin, {
    userId: minted.userId,
    email: resolved.email,
  });

  if (!finished.ok) {
    const response = loginRedirect(origin, finished.errorCode, finished.reason);
    return applyCookies(response, minted.sessionCookies);
  }

  const response = NextResponse.redirect(new URL(finished.redirectPath, origin));
  return applyCookies(response, minted.sessionCookies);
}
