import type { SupabaseClientOptions } from "@supabase/supabase-js";

const sharedPkceAuth = {
  flowType: "pkce" as const,
  persistSession: true,
  detectSessionInUrl: true,
};

/**
 * Browser-only options: passkeys require `experimental.passkey`.
 * Do not pass this into `createServerClient` / Edge middleware — it can break the Edge runtime.
 * @see https://supabase.com/docs/guides/auth/auth-passkeys
 */
export const wayfinderAuthOptions: Pick<
  SupabaseClientOptions<"public">,
  "auth"
> = {
  auth: {
    ...sharedPkceAuth,
    experimental: {
      passkey: true,
    },
  },
};

/** Safe for Next.js middleware (Edge) and server components / route handlers. */
export const wayfinderServerAuthOptions: Pick<
  SupabaseClientOptions<"public">,
  "auth"
> = {
  auth: {
    ...sharedPkceAuth,
  },
};
