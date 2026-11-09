/** Production host for Rendezvous (booking, cancel, reschedule, and email links). */
export const RENDEZVOUS_PRODUCTION_ORIGIN = "https://rendezvous.thejoshuatree.org";

/**
 * Canonical public origin for absolute links (booking page, cancel/reschedule,
 * Calendar webhook, emails). Prefer server `APP_BASE_URL`, then public env aliases,
 * then the production domain — never a preview `*.vercel.app` URL for mailed links.
 */
export function rendezvousAppBaseUrl(): string {
  const candidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_BASE_URL,
    process.env.NEXT_PUBLIC_RENDEZVOUS_APP_URL,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (value) return value.replace(/\/$/, "");
  }

  if (process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "development") {
    return "http://localhost:3003";
  }

  return RENDEZVOUS_PRODUCTION_ORIGIN;
}

export function buildPublicBookingUrl(slug: string): string {
  return `${rendezvousAppBaseUrl()}/book/${encodeURIComponent(slug)}`;
}

export function buildManageUrl(kind: "cancel" | "reschedule", token: string): string {
  return `${rendezvousAppBaseUrl()}/manage/${kind}?token=${encodeURIComponent(token)}`;
}

export function cronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  if (header === `Bearer ${secret}`) return true;
  const url = new URL(request.url);
  return url.searchParams.get("secret") === secret;
}
