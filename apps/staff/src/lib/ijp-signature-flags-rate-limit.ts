/** In-memory per-user sliding window. Soft guardrail for serverless flood containment. */
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 20;

const hitsByUser = new Map<string, number[]>();

export function ijpSignatureFlagsRateLimited(userId: string, now = Date.now()): boolean {
  const cutoff = now - WINDOW_MS;
  const prev = hitsByUser.get(userId) ?? [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hitsByUser.set(userId, recent);
    return true;
  }
  recent.push(now);
  hitsByUser.set(userId, recent);
  return false;
}

/** Test helper — clears in-memory counters. */
export function resetIjpSignatureFlagsRateLimitForTests(): void {
  hitsByUser.clear();
}

export const IJP_SIGNATURE_FLAGS_MAX_CLIENT_IDS = 50;

/** Kill switch: set IJP_SIGNATURE_FLAGS_DISABLED=true|1 to return empty flags. Default ON. */
export function ijpSignatureFlagsDisabledByEnv(
  env: Record<string, string | undefined> = process.env
): boolean {
  const raw = (env.IJP_SIGNATURE_FLAGS_DISABLED ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}
