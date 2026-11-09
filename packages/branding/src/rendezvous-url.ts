import { WAYFINDER_RENDEZVOUS_URL } from "./constants";

/**
 * Canonical Rendezvous origin. Prefer `APP_BASE_URL` / public aliases; fall back to
 * https://rendezvous.thejoshuatree.org (never invent a preview host).
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
  return WAYFINDER_RENDEZVOUS_URL.replace(/\/$/, "");
}

export function buildRendezvousAppUrl(path = "/"): string {
  const base = rendezvousAppBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
