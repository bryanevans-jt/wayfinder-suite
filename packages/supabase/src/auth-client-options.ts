import type { SerializeOptions } from "cookie";

const sharedPkceAuth = {
  flowType: "pkce" as const,
  persistSession: true,
  detectSessionInUrl: true,
};

/**
 * Parent-domain cookies for shared sign-in across Wayfinder subdomains.
 * Set `NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN=.thejoshuatree.org` in production only.
 */
export function wayfinderCookieOptions(): SerializeOptions | undefined {
  const domain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;
  return {
    domain,
    path: "/",
    sameSite: "lax",
    secure: true,
  };
}

const cookieOptions = wayfinderCookieOptions();

/**
 * Browser-only options: passkeys require `experimental.passkey`.
 * Do not pass this into `createServerClient` / Edge middleware — it can break the Edge runtime.
 * @see https://supabase.com/docs/guides/auth/auth-passkeys
 */
export const wayfinderAuthOptions = {
  auth: {
    ...sharedPkceAuth,
    experimental: {
      passkey: true,
    },
  },
  ...(cookieOptions ? { cookieOptions } : {}),
};

/** Safe for Next.js middleware (Edge) and server components / route handlers. */
export const wayfinderServerAuthOptions = {
  auth: {
    ...sharedPkceAuth,
  },
  ...(cookieOptions ? { cookieOptions } : {}),
};
