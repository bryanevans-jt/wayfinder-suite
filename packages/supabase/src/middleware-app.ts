import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { wayfinderServerAuthOptions } from "./auth-client-options";
import type { SupabaseCookieToSet } from "./cookie-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";
import { loadAuthUserProfile } from "./auth-profile";
import { isClientRole, isKnownRole, isStaffRole } from "./roles";
import { isPreviewMutationBlocked, resolvePreviewSession } from "./preview-middleware";

export type WayfinderAppKind = "staff" | "client";

export type WayfinderAuthMiddlewareContext = {
  response: NextResponse;
  userId: string | null;
  actorRole: string | null;
  effectiveRole: string | null;
  /** Whether app-specific middleware should continue evaluating protected-route rules. */
  shouldContinue: boolean;
};

function authContext(
  response: NextResponse,
  values: Partial<Omit<WayfinderAuthMiddlewareContext, "response">> = {}
): WayfinderAuthMiddlewareContext {
  return {
    response,
    userId: values.userId ?? null,
    actorRole: values.actorRole ?? null,
    effectiveRole: values.effectiveRole ?? null,
    shouldContinue: values.shouldContinue ?? false,
  };
}

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

const AUTH_CALLBACK_PATH = "/auth/callback";
const AUTH_CONFIRM_PATH = "/auth/confirm";
const AUTH_ACCESS_PATH = "/auth/access";

/**
 * Supabase emails sometimes land on Site URL root (`/?token_hash=…`) when RedirectTo
 * is the app origin or the dashboard template was not re-pasted. Route to confirm/callback.
 */
export function redirectStrayEmailAuthParams(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): NextResponse | null {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith(AUTH_CALLBACK_PATH) ||
    pathname.startsWith(AUTH_CONFIRM_PATH) ||
    pathname.startsWith(AUTH_ACCESS_PATH) ||
    pathname.startsWith("/api/auth")
  ) {
    return null;
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const code = params.get("code");
  const tokenHashParam = params.get("token_hash");
  const tokenParam = params.get("token");

  if (context.app === "staff" && tokenParam && !type && !tokenHashParam && pathname !== AUTH_ACCESS_PATH) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_ACCESS_PATH;
    return NextResponse.redirect(url);
  }

  const tokenHash = tokenHashParam ?? (type ? tokenParam : null);

  if (tokenHash && type) {
    const url = request.nextUrl.clone();
    url.pathname = context.app === "staff" ? AUTH_CONFIRM_PATH : AUTH_CALLBACK_PATH;
    url.searchParams.set("token_hash", tokenHash);
    url.searchParams.set("type", type);
    url.searchParams.delete("token");
    return NextResponse.redirect(url);
  }

  if (code) {
    const url = request.nextUrl.clone();
    url.pathname = AUTH_CALLBACK_PATH;
    return NextResponse.redirect(url);
  }

  return null;
}

function redirectPreservingCookies(
  cookiesToSet: SupabaseCookieToSet[],
  redirectUrl: URL | string
): NextResponse {
  const target =
    typeof redirectUrl === "string" ? new URL(redirectUrl) : redirectUrl;
  const out = NextResponse.redirect(target);
  cookiesToSet.forEach(({ name, value, options }) => {
    out.cookies.set(name, value, options);
  });
  return out;
}

/**
 * Refreshes the session, loads `profiles`, and routes users to the correct app
 * (`NEXT_PUBLIC_CLIENT_APP_URL` vs `NEXT_PUBLIC_STAFF_APP_URL`) by role.
 */
export async function wayfinderAuthMiddlewareWithContext(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): Promise<WayfinderAuthMiddlewareContext> {
  let response = NextResponse.next({ request });
  let sessionCookies: SupabaseCookieToSet[] = [];

  const { pathname } = request.nextUrl;
  const handlerAuthenticatedRead =
    request.method === "GET" &&
    pathname === "/api/report-alerts";
  if (handlerAuthenticatedRead) {
    return authContext(response);
  }

  let supabaseUrl: string;
  let supabaseAnonKey: string;
  try {
    supabaseUrl = getSupabaseUrl();
    supabaseAnonKey = getSupabaseAnonKey();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Missing Supabase environment variables.";
    return authContext(
      new NextResponse(
        `Wayfinder configuration error: ${message}\n\nSet NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY for this app.`,
        { status: 503, headers: { "content-type": "text/plain; charset=utf-8" } }
      )
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    ...wayfinderServerAuthOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        sessionCookies = cookiesToSet;
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

  if (pathname.startsWith("/walkthrough")) {
    return authContext(response);
  }

  if (!user) {
    const authLanding = redirectStrayEmailAuthParams(request, context);
    if (authLanding) {
      return authContext(authLanding);
    }

    if (pathname === "/" || pathname.startsWith("/dashboard")) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.delete("token_hash");
      url.searchParams.delete("token");
      url.searchParams.delete("type");
      url.searchParams.delete("code");
      return authContext(NextResponse.redirect(url));
    }
    return authContext(response);
  }

  const { profile, errorMessage } = await loadAuthUserProfile(supabase, user.id);

  if (!profile || !isKnownRole(profile.role)) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("error", "no_profile");
    if (errorMessage) {
      url.searchParams.set("reason", errorMessage);
    } else if (!profile) {
      url.searchParams.set(
        "reason",
        `No profile row visible for user ${user.id} (check RLS or Supabase project URL).`
      );
    } else {
      url.searchParams.set("reason", `Unrecognized role: ${profile.role ?? "(empty)"}`);
    }
    return authContext(redirectPreservingCookies(sessionCookies, url), {
      userId: user.id,
    });
  }

  if (!profile.is_active) {
    await supabase.auth.signOut();
    const url = request.nextUrl.clone();
    url.pathname = "/account-inactive";
    url.searchParams.set("reason", "inactive");
    return authContext(redirectPreservingCookies(sessionCookies, url), {
      userId: user.id,
      actorRole: profile.role,
      effectiveRole: profile.role,
    });
  }

  const previewSession = resolvePreviewSession(
    request,
    user.id,
    profile.role
  );

  if (isPreviewMutationBlocked(request, previewSession.isPreviewReadOnly)) {
    return authContext(
      new NextResponse("Read-only preview — exit preview to make changes.", {
        status: 403,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
      {
        userId: user.id,
        actorRole: profile.role,
        effectiveRole: previewSession.effectiveRole,
      }
    );
  }

  const effectiveRole = previewSession.effectiveRole;

  const staffOrigin = staffAppOrigin();
  const clientOrigin = clientAppOrigin();
  const requestOrigin = request.nextUrl.origin;

  const wantsStaff = isStaffRole(effectiveRole);
  const wantsClient = isClientRole(effectiveRole);

  if (pathname.startsWith("/api/preview/handoff") || pathname.startsWith("/api/preview/stop")) {
    return authContext(response, {
      userId: user.id,
      actorRole: profile.role,
      effectiveRole,
    });
  }

  if (wantsClient && context.app === "staff") {
    if (pathname === "/login") {
      return authContext(response, {
        userId: user.id,
        actorRole: profile.role,
        effectiveRole,
      });
    }
    return authContext(
      redirectPreservingCookies(sessionCookies, new URL("/dashboard", clientOrigin)),
      { userId: user.id, actorRole: profile.role, effectiveRole }
    );
  }

  if (wantsStaff && context.app === "client") {
    if (pathname === "/login") {
      return authContext(response, {
        userId: user.id,
        actorRole: profile.role,
        effectiveRole,
      });
    }
    return authContext(
      redirectPreservingCookies(sessionCookies, new URL("/dashboard", staffOrigin)),
      { userId: user.id, actorRole: profile.role, effectiveRole }
    );
  }

  const roleMatchesApp =
    (wantsStaff && context.app === "staff") ||
    (wantsClient && context.app === "client");

  if (roleMatchesApp) {
    if (pathname === "/login" || pathname === "/") {
      return authContext(
        redirectPreservingCookies(sessionCookies, new URL("/dashboard", requestOrigin)),
        { userId: user.id, actorRole: profile.role, effectiveRole }
      );
    }
    if (pathname === "/account-inactive") {
      return authContext(
        redirectPreservingCookies(sessionCookies, new URL("/dashboard", requestOrigin)),
        { userId: user.id, actorRole: profile.role, effectiveRole }
      );
    }
  }

  return authContext(response, {
    userId: user.id,
    actorRole: profile.role,
    effectiveRole,
    shouldContinue: roleMatchesApp,
  });
}

export async function wayfinderAuthMiddleware(
  request: NextRequest,
  context: { app: WayfinderAppKind }
): Promise<NextResponse> {
  return (await wayfinderAuthMiddlewareWithContext(request, context)).response;
}
