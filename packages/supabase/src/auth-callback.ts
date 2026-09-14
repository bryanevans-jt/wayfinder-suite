import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "./admin-server";
import { wayfinderServerAuthOptions } from "./auth-client-options";
import type { SupabaseCookieToSet } from "./cookie-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

function redirectToLogin(origin: string, error = "auth", reason?: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", error);
  const detail = reason?.trim();
  if (detail) {
    login.searchParams.set("reason", detail.slice(0, 240));
  }
  return NextResponse.redirect(login);
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
  return /signups not allowed|user not found|invalid login credentials|email not confirmed/i.test(
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

async function rejectAuthenticatedSession(
  supabase: ReturnType<typeof createServerClient>,
  origin: string,
  error: string,
  setRedirect: (url: URL) => void
): Promise<void> {
  const login = new URL("/login", origin);
  login.searchParams.set("error", error);
  setRedirect(login);
  await supabase.auth.signOut();
}

export type WayfinderAuthCallbackOptions = {
  onAuthenticated?: (ctx: {
    userId: string;
    email: string | null;
  }) => Promise<void>;
  serverAuthOptions?: typeof wayfinderServerAuthOptions;
  /** Sign out when no profiles row exists (invite-only). */
  requireProvisionedProfile?: boolean;
  /** Reject sign-in unless email is @{domain} (e.g. reports). */
  allowedEmailDomain?: string;
};

/**
 * Completes magic-link / OAuth sign-in for Next.js route handlers.
 * Supports PKCE (`code`) and direct OTP verify (`token_hash` + `type`) — the latter
 * is required for admin `generate_link` links pasted without a browser OTP flow.
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

  const redirectTarget = new URL(next, url.origin);
  let response = NextResponse.redirect(redirectTarget);
  let activeRedirect = redirectTarget;

  const redirectTo = (target: URL) => {
    activeRedirect = target;
    response = NextResponse.redirect(activeRedirect);
  };

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...(options?.serverAuthOptions ?? wayfinderServerAuthOptions),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(activeRedirect);
        cookiesToSet.forEach(({ name, value, options: cookieOptions }) =>
          response.cookies.set(name, value, cookieOptions)
        );
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await verifyOtpWithFallback(supabase, tokenHash!, type!);

  if (error) {
    return redirectToLogin(
      url.origin,
      isInviteOnlyAuthError(error.message) ? "not_set_up" : "auth",
      authFailureReason(error.message)
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
      await rejectAuthenticatedSession(supabase, url.origin, "org_only", redirectTo);
      return response;
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
      await rejectAuthenticatedSession(supabase, url.origin, "not_set_up", redirectTo);
      return response;
    }
  }

  if (options?.onAuthenticated) {
    await options.onAuthenticated({
      userId: user.id,
      email: user.email ?? null,
    });
  }

  return response;
}
