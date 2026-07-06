/** Supabase SSR cookie prefix, e.g. `sb-whwetcxrebbuimkozmes-auth-token`. */
export function supabaseAuthStorageKeyPrefix(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!url) return "sb-auth-token";
  try {
    const ref = new URL(url).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : "sb-auth-token";
  } catch {
    return "sb-auth-token";
  }
}

function expireBrowserCookie(name: string, domain?: string) {
  let cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    cookie += "; Secure";
  }
  if (domain) {
    cookie += `; domain=${domain}`;
  }
  document.cookie = cookie;
}

/**
 * Browser-only: drop stale PKCE verifier cookies before starting OAuth or magic link.
 * Prevents cross-subdomain collisions when Wayfinder Pro and Reports share auth cookies.
 */
export function clearSupabasePkceVerifierCookies(): void {
  if (typeof document === "undefined") return;

  const verifierPrefix = `${supabaseAuthStorageKeyPrefix()}-code-verifier`;
  const sharedDomain = process.env.NEXT_PUBLIC_SUPABASE_COOKIE_DOMAIN?.trim();
  const names = document.cookie
    .split(";")
    .map((part) => part.trim().split("=")[0])
    .filter((name): name is string => Boolean(name));

  for (const name of names) {
    if (name !== verifierPrefix && !name.startsWith(`${verifierPrefix}.`)) {
      continue;
    }
    expireBrowserCookie(name);
    if (sharedDomain) {
      expireBrowserCookie(name, sharedDomain);
    }
  }
}
