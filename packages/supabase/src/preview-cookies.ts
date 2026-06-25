import { wayfinderCookieOptions } from "./auth-client-options";
import { isKnownRole } from "./roles";

export const PREVIEW_TARGET_COOKIE = "wf_preview_target";
export const PREVIEW_ACTOR_COOKIE = "wf_preview_actor";
export const PREVIEW_ROLE_COOKIE = "wf_preview_role";
export const PREVIEW_NAME_COOKIE = "wf_preview_name";

export const PREVIEW_COOKIE_MAX_AGE_SEC = 60 * 60 * 8;

export type PreviewCookieSet = {
  targetUserId: string;
  actorUserId: string;
  targetRole: string;
  targetName: string | null;
};

export function readPreviewCookies(
  get: (name: string) => string | undefined
): PreviewCookieSet | null {
  const targetUserId = get(PREVIEW_TARGET_COOKIE);
  const actorUserId = get(PREVIEW_ACTOR_COOKIE);
  const targetRole = get(PREVIEW_ROLE_COOKIE);
  if (!targetUserId || !actorUserId || !targetRole) {
    return null;
  }
  if (!isKnownRole(targetRole)) {
    return null;
  }
  const targetName = get(PREVIEW_NAME_COOKIE) ?? null;
  return { targetUserId, actorUserId, targetRole, targetName };
}

export function previewCookieOptions(maxAge = PREVIEW_COOKIE_MAX_AGE_SEC) {
  const shared = wayfinderCookieOptions();
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
    ...(shared?.domain
      ? { domain: shared.domain, secure: shared.secure ?? true }
      : {}),
  };
}

export const PREVIEW_COOKIE_NAMES = [
  PREVIEW_TARGET_COOKIE,
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_NAME_COOKIE,
] as const;

/** Clear preview cookies on a Next.js response (match domain from previewCookieOptions). */
export function clearPreviewCookiesOnResponse(response: {
  cookies: {
    set: (
      name: string,
      value: string,
      options?: {
        httpOnly?: boolean;
        sameSite?: "lax" | "strict" | "none";
        path?: string;
        maxAge?: number;
        expires?: Date;
        domain?: string;
        secure?: boolean;
      }
    ) => void;
  };
}): void {
  const base = previewCookieOptions(0);
  const expires = new Date(0);
  for (const name of PREVIEW_COOKIE_NAMES) {
    response.cookies.set(name, "", {
      ...base,
      maxAge: 0,
      expires,
    });
  }
}
