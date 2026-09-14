import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { ensureClientAuthProfile } from "@wayfinder/supabase";
import {
  handleWayfinderAuthCallback,
  isFailedAuthLoginRedirect,
} from "@wayfinder/supabase/auth-callback";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function staffAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_STAFF_APP_URL?.trim();
  if (!raw) return null;
  return raw.replace(/\/$/, "");
}

/**
 * Client app callback. Magic links for Wayfinder Pro (counselors, ES) sometimes
 * land here when Supabase Site URL or email scanners point at the client host.
 * Relay failed code/token exchanges to the staff callback once.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const hasExchangeParams =
    url.searchParams.has("code") ||
    (url.searchParams.has("token_hash") && url.searchParams.has("type"));

  const response = await handleWayfinderAuthCallback(request, {
    requireProvisionedProfile: true,
    onAuthenticated: async ({ userId, email }) => {
      const admin = createServiceRoleClient();
      await ensureClientAuthProfile(admin, userId, email);
    },
  });

  const staffOrigin = staffAppOrigin();
  if (
    staffOrigin &&
    staffOrigin !== url.origin &&
    hasExchangeParams &&
    isFailedAuthLoginRedirect(response, url.origin)
  ) {
    const relay = new URL("/auth/callback", staffOrigin);
    relay.search = url.search;
    return NextResponse.redirect(relay);
  }

  return response;
}
