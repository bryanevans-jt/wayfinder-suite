import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  type SupabaseCookieToSet,
} from "@wayfinder/supabase";
import { requestHasSupabaseAuthSessionCookie } from "@wayfinder/supabase/auth-session-cookies";
import {
  MiddlewareAuthTimeoutError,
  withMiddlewareAuthTimeout,
} from "@wayfinder/supabase/middleware-auth-timeout";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { rendezvousServerAuthOptions } from "@/lib/supabase/auth-options";
import { NextResponse, type NextRequest } from "next/server";

const ORG_DOMAIN = "thejoshuatree.org";

const PUBLIC_PREFIXES = ["/book/", "/manage/", "/api/book", "/api/slots", "/api/cancel", "/api/reschedule", "/api/google/webhook", "/api/health", "/api/cron/"];

function isPublicPath(pathname: string): boolean {
  if (pathname.startsWith("/auth/")) return true;
  if (pathname === "/login") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

async function loadRole(
  supabase: ReturnType<typeof createServerClient>
): Promise<string | null> {
  const { data: rpcRows, error } = await supabase.rpc("get_auth_user_profile");
  if (!error && rpcRows) {
    const row = (Array.isArray(rpcRows) ? rpcRows[0] : rpcRows) as { role?: string } | undefined;
    if (row?.role) return String(row.role).toLowerCase();
  }
  return null;
}

/**
 * Authenticated staff surfaces stay dark unless the caller is a super admin.
 * Feature flag is enforced in page/API handlers (needs DB). Public booking
 * routes stay reachable so counselors can book enabled schedules.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/api/")) {
    // API routes enforce their own gates (404 when dark).
    if (pathname.startsWith("/api/") && !isPublicPath(pathname)) {
      // fall through to auth for protected APIs when a session cookie exists;
      // handlers still return 404 without access.
    } else if (isPublicPath(pathname) && !pathname.startsWith("/login") && !pathname.startsWith("/auth/")) {
      return response;
    }
  }

  if (pathname.startsWith("/api/")) {
    return response;
  }

  const hasSessionCookie = requestHasSupabaseAuthSessionCookie(request.cookies.getAll());

  if (pathname === "/login" && !hasSessionCookie) {
    return response;
  }

  const needsAuth =
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/calendar") ||
    pathname === "/login";

  if (!hasSessionCookie && needsAuth && pathname !== "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  if (!hasSessionCookie) {
    return response;
  }

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseAnonKey = getSupabaseAnonKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Missing Supabase environment variables.";
    return new NextResponse(
      `Rendezvous configuration error: ${message}`,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...rendezvousServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>["data"]["user"];
  try {
    ({
      data: { user },
    } = await withMiddlewareAuthTimeout("Supabase auth.getUser()", supabase.auth.getUser()));
  } catch (err) {
    if (err instanceof MiddlewareAuthTimeoutError) {
      return new NextResponse("Sign-in is temporarily slow. Wait a moment and refresh.", {
        status: 503,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    throw err;
  }

  if (!user) {
    if (pathname === "/login") return response;
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirect);
  }

  const email = user.email || "";
  if (!email.endsWith(`@${ORG_DOMAIN}`)) {
    await supabase.auth.signOut();
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("error", "org_only");
    return NextResponse.redirect(redirect);
  }

  const role = (await loadRole(supabase)) ?? "";
  // Stay invisible: non–super-admins hitting staff routes get a bland not-found.
  // Feature flag is checked in page loaders (DB). Middleware only role-gates discovery.
  if (
    (pathname === "/" || pathname.startsWith("/admin") || pathname.startsWith("/calendar")) &&
    !isSuperAdminRole(role)
  ) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  if (pathname === "/login") {
    const next = request.nextUrl.searchParams.get("next");
    const redirect = request.nextUrl.clone();
    redirect.pathname =
      next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf)$).*)",
  ],
};
