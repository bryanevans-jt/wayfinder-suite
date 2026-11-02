import { supabaseAuthStorageKeyPrefix } from "./auth-pkce-cookies";

/** True when chunked Supabase SSR session cookies are present on the request. */
export function requestHasSupabaseAuthSessionCookie(
  cookies: ReadonlyArray<{ name: string }>
): boolean {
  const prefix = supabaseAuthStorageKeyPrefix();
  return cookies.some(
    (cookie) => cookie.name === prefix || cookie.name.startsWith(`${prefix}.`)
  );
}
