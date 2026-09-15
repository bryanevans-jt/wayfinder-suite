import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "./admin-server";
import { wayfinderServerAuthOptions } from "./auth-client-options";
import type { SupabaseCookieToSet } from "./cookie-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

function buildLoginUrl(origin: string, error = "auth", reason?: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", error);
  const detail = reason?.trim();
  if (detail) {
    login.searchParams.set("reason", detail.slice(0, 240));
  }
  return login;
}

function redirectToLogin(
  origin: string,
  error = "auth",
  reason?: string,
  sessionCookies: SupabaseCookieToSet[] = []
) {
  const response = NextResponse.redirect(buildLoginUrl(origin, error, reason));
  return applyCookiesToResponse(response, sessionCookies);
}

function authFailureReason(message: string): string | undefined {
  if (/pkce|code verifier|validation/i.test(message)) {
    return "pkce_verifier";
  }
  if (/expired|invalid.*code|flow state/i.test(message)) {
    return "link_expired";
  }
  if (/redirect/i.test(message)) {
    return "redirect_mismatch";
  }
  return undefined;
}

/** True when the handler redirected to /login with an auth error (for cross-app relay). */
export function isFailedAuthLoginRedirect(
  response: NextResponse,
  requestOrigin: string
): boolean {
  const location = response.headers.get("location");
  if (!location) return false;
  try {
    const url = new URL(location, requestOrigin);
    return url.pathname === "/login" && url.searchParams.get("error") === "auth";
  } catch {
    return false;
  }
}

function isInviteOnlyAuthError(message: string): boolean {
  return /signups not allowed|user not found|invalid login credentials|email not confirmed|not confirmed|confirm your email/i.test(
    message
  );
}

async function verifyOtpWithFallback(
  supabase: SupabaseClient,
  tokenHash: string,
  type: string
) {
  const typesToTry = [
    type,
    type === "magiclink" ? "email" : null,
    "invite",
    "signup",
    "email",
    "magiclink",
  ].filter(Boolean) as EmailOtpType[];

  const uniqueTypes = [...new Set(typesToTry)];
  let lastError: { message: string } | null = null;

  for (const otpType of uniqueTypes) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    });
    if (!error) {
      return { error: null };
    }
    lastError = error;
  }

  return { error: lastError };
}

function applyCookiesToResponse(
  response: NextResponse,
  cookiesToSet: SupabaseCookieToSet[]
): NextResponse {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}

export type WayfinderAuthCallbackOptions = {
  onAuthenticated?: (ctx: {
    userId: string;
    email: string | null;
  }) => Promise<string | void>;
  /**
   * Runs after Auth succeeds and before {@link requireProvisionedProfile} — use to link
   * counselor profiles on first magic-link sign-in.
   */
  prepareAuthenticatedUser?: (ctx: {
    userId: string;
    email: string | null;
  }) => Promise<{ error?: string; reason?: string } | void>;
  serverAuthOptions?: typeof wayfinderServerAuthOptions;
  /** Sign out when no profiles row exists (invite-only). */
  requireProvisionedProfile?: boolean;
  /** Reject sign-in unless email is @{domain} (e.g. reports). */
  allowedEmailDomain?: string;
};

/**
 * Completes magic-link / OAuth sign-in for Next.js route handlers.
 * Uses the Next.js cookie store so session cookies keep HttpOnly/path/domain options.
 */
export async function handleWayfinderAuthCallback(
  request: NextRequest,
  options?: WayfinderAuthCallbackOptions
): Promise<NextResponse> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash =
    url.searchParams.get("token_hash") ?? url.searchParams.get("token");
  const type = url.searchParams.get("type");
  const next = url.searchParams.get("next") ?? "/dashboard";
  const authError = url.searchParams.get("error");

  if (authError) {
    return redirectToLogin(url.origin);
  }

  if (!code && !(tokenHash && type)) {
    return redirectToLogin(url.origin);
  }

  const cookieStore = await cookies();
  let sessionCookies: SupabaseCookieToSet[] = [];

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...(options?.serverAuthOptions ?? wayfinderServerAuthOptions),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        sessionCookies = cookiesToSet;
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
            cookieStore.set(name, value, cookieOptions)
          );
        } catch {
          // Route handlers should allow set; ignore in edge read-only contexts.
        }
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await verifyOtpWithFallback(supabase, tokenHash!, type!);

  if (error) {
    const mapped = authFailureReason(error.message);
    const reason =
      mapped ??
      (isInviteOnlyAuthError(error.message) ? undefined : error.message.slice(0, 240));
    return redirectToLogin(
      url.origin,
      isInviteOnlyAuthError(error.message) ? "not_set_up" : "auth",
      reason
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin(url.origin);
  }

  const email = user.email?.trim().toLowerCase() ?? null;

  if (options?.allowedEmailDomain) {
    const domain = options.allowedEmailDomain.toLowerCase().replace(/^@/, "");
    if (!email?.endsWith(`@${domain}`)) {
      await supabase.auth.signOut();
      return redirectToLogin(url.origin, "org_only", undefined, sessionCookies);
    }
  }

  if (options?.prepareAuthenticatedUser) {
    try {
      const prepResult = await options.prepareAuthenticatedUser({
        userId: user.id,
        email: user.email ?? null,
      });
      if (prepResult?.error) {
        await supabase.auth.signOut();
        return redirectToLogin(
          url.origin,
          prepResult.error,
          prepResult.reason,
          sessionCookies
        );
      }
    } catch (err) {
      console.error("auth callback prepareAuthenticatedUser:", err);
      await supabase.auth.signOut();
      return redirectToLogin(url.origin, "auth", undefined, sessionCookies);
    }
  }

  if (options?.requireProvisionedProfile) {
    const admin = createServiceRoleClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) {
      await supabase.auth.signOut();
      return redirectToLogin(url.origin, "not_set_up", undefined, sessionCookies);
    }
  }

  let destination = new URL(next, url.origin);

  if (options?.onAuthenticated) {
    const nextOverride = await options.onAuthenticated({
      userId: user.id,
      email: user.email ?? null,
    });
    if (nextOverride?.startsWith("/")) {
      destination = new URL(nextOverride, url.origin);
    }
  }

  const response = NextResponse.redirect(destination);
  return applyCookiesToResponse(response, sessionCookies);
}
