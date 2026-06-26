import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { wayfinderServerAuthOptions } from "./auth-client-options";
import type { SupabaseCookieToSet } from "./cookie-types";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

function redirectToLogin(origin: string) {
  const login = new URL("/login", origin);
  login.searchParams.set("error", "auth");
  return NextResponse.redirect(login);
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

/**
 * Completes magic-link / OAuth sign-in for Next.js route handlers.
 * Supports PKCE (`code`) and direct OTP verify (`token_hash` + `type`) — the latter
 * is required for admin `generate_link` links pasted without a browser OTP flow.
 */
export async function handleWayfinderAuthCallback(
  request: NextRequest,
  options?: {
    onAuthenticated?: (ctx: {
      userId: string;
      email: string | null;
    }) => Promise<void>;
    serverAuthOptions?: typeof wayfinderServerAuthOptions;
  }
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

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    ...(options?.serverAuthOptions ?? wayfinderServerAuthOptions),
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: SupabaseCookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(redirectTarget);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await verifyOtpWithFallback(supabase, tokenHash!, type!);

  if (error) {
    return redirectToLogin(url.origin);
  }

  if (options?.onAuthenticated) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await options.onAuthenticated({
        userId: user.id,
        email: user.email ?? null,
      });
    }
  }

  return response;
}
