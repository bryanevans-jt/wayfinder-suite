import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requestHasSupabaseAuthSessionCookie } from "./auth-session-cookies";
import type { WayfinderAppKind } from "./middleware-app-types";
import { redirectStrayEmailAuthParams } from "./middleware-email-auth-redirect";

const AUTH_QUERY_KEYS = ["token_hash", "token", "type", "code"] as const;

function clearsAuthQueryParams(url: URL): void {
  for (const key of AUTH_QUERY_KEYS) {
    url.searchParams.delete(key);
  }
}

export function middlewareSkipsSupabaseAuth(pathname: string): boolean {
  if (pathname === "/login") return true;
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  return false;
}

/**
 * Avoid Supabase round trips on the Edge for routes that do not need them.
 * Returns a response when auth middleware work can stop early; null when session validation is required.
 */
export function tryMiddlewareAnonymousAuthResponse(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): NextResponse | null {
  const { pathname } = request.nextUrl;

  if (middlewareSkipsSupabaseAuth(pathname)) {
    return redirectStrayEmailAuthParams(request, context) ?? NextResponse.next({ request });
  }

  const hasSessionCookie = requestHasSupabaseAuthSessionCookie(request.cookies.getAll());
  if (hasSessionCookie) {
    return null;
  }

  const stray = redirectStrayEmailAuthParams(request, context);
  if (stray) {
    return stray;
  }

  if (pathname.startsWith("/walkthrough")) {
    return NextResponse.next({ request });
  }

  if (pathname === "/" || pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    clearsAuthQueryParams(url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
