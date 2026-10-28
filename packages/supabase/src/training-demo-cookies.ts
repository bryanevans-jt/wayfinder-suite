import { wayfinderCookieOptions } from "./auth-client-options";
import { isKnownRole } from "./roles";

export const TRAINING_TARGET_COOKIE = "wf_training_target";
export const TRAINING_ACTOR_COOKIE = "wf_training_actor";
export const TRAINING_ROLE_COOKIE = "wf_training_role";
export const TRAINING_NAME_COOKIE = "wf_training_name";

export const TRAINING_COOKIE_MAX_AGE_SEC = 60 * 60 * 8;

export type TrainingDemoCookieSet = {
  targetUserId: string;
  actorUserId: string;
  targetRole: string;
  targetName: string | null;
};

export function readTrainingDemoCookies(
  get: (name: string) => string | undefined
): TrainingDemoCookieSet | null {
  const targetUserId = get(TRAINING_TARGET_COOKIE);
  const actorUserId = get(TRAINING_ACTOR_COOKIE);
  const targetRole = get(TRAINING_ROLE_COOKIE);
  if (!targetUserId || !actorUserId || !targetRole) {
    return null;
  }
  if (!isKnownRole(targetRole)) {
    return null;
  }
  return {
    targetUserId,
    actorUserId,
    targetRole,
    targetName: get(TRAINING_NAME_COOKIE) ?? null,
  };
}

export function trainingDemoCookieOptions(maxAge = TRAINING_COOKIE_MAX_AGE_SEC) {
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

export const TRAINING_DEMO_COOKIE_NAMES = [
  TRAINING_TARGET_COOKIE,
  TRAINING_ACTOR_COOKIE,
  TRAINING_ROLE_COOKIE,
  TRAINING_NAME_COOKIE,
] as const;
