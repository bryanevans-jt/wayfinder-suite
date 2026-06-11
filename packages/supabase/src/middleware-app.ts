import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { wayfinderServerAuthOptions } from "./auth-client-options";
import type { SupabaseCookieToSet } from "./cookie-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";
import { isClientRole, isKnownRole, isStaffRole } from "./roles";
import { isPreviewMutationBlocked, resolvePreviewSession } from "./preview-middleware";

export type WayfinderAppKind = "staff" | "client";

function staffAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_STAFF_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

function clientAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001";
  return raw.replace(/\/$/, "");
}

function redirectPreservingCookies(
  from: NextResponse,
  redirectUrl: URL | string
): NextResponse {
  const target =
    typeof redirectUrl === "string" ? new URL(redirectUrl) : redirectUrl;
  const out = NextResponse.redirect(target);
  from.cookies.getAll().forEach((cookie) => {
    out.cookies.set(cookie.name, cookie.value);
  });
  return out;
}

/**
 * Refreshes the session, loads `profiles`, and routes users to the correct app
 * (`NEXT_PUBLIC_CLIENT_APP_URL` vs `NEXT_PUBLIC_STAFF_APP_URL`) by role.
 */
export async function wayfinderAuthMiddleware(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseAnonKey = getSupabaseAnonKey();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Missing Supabase environment variables.";
    return new NextResponse(
      `Wayfinder configuration error: ${message}\n\nSet NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this app.`,
      { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...wayfinderServerAuthOptions,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (pathname === "/" || pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
    return response;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || !isKnownRole(profile.role)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no_profile");
    if (profileError?.message) {
      url.searchParams.set("reason", profileError.message);
    } else if (!profile) {
      url.searchParams.set(
        "reason",
        `No profile row visible for user ${user.id} (check RLS or Supabase project URL in .env.local).`
      );
    } else {
      url.searchParams.set("reason", `Unrecognized role: ${profile.role ?? "(empty)"}`);
    }
    return redirectPreservingCookies(response, url);
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/account-inactive";
    url.searchParams.set("reason", "inactive");
    return redirectPreservingCookies(response, url);
  }

  const previewSession = resolvePreviewSession(
    request,
    user.id,
    profile.role
  );

  if (isPreviewMutationBlocked(request, previewSession.isPreviewReadOnly)) {
    return new NextResponse("Read-only preview — exit preview to make changes.", {
      status: 403,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const effectiveRole = previewSession.effectiveRole;

  const staffOrigin = staffAppOrigin();
  const clientOrigin = clientAppOrigin();
  const requestOrigin = request.nextUrl.origin;

  const wantsStaff = isStaffRole(effectiveRole);
  const wantsClient = isClientRole(effectiveRole);

  if (wantsClient && context.app === "staff") {
    if (pathname === "/login") {
      return response;
    }
    return redirectPreservingCookies(response, new URL("/dashboard", clientOrigin));
  }

  if (wantsStaff && context.app === "client") {
    if (pathname === "/login") {
      return response;
    }
    return redirectPreservingCookies(response, new URL("/dashboard", staffOrigin));
  }

  const roleMatchesApp =
    (wantsStaff && context.app === "staff") ||
    (wantsClient && context.app === "client");

  if (roleMatchesApp) {
    if (pathname === "/login" || pathname === "/") {
      return redirectPreservingCookies(response, new URL("/dashboard", requestOrigin));
    }
    if (pathname === "/account-inactive") {
      return redirectPreservingCookies(response, new URL("/dashboard", requestOrigin));
    }
  }

  return response;
}
