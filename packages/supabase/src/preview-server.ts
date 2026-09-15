import { cookies } from "next/headers";
import { createClient } from "./server";
import {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
  readPreviewCookies,
} from "./preview-cookies";
import { loadAuthUserProfile } from "./auth-profile";
import { isKnownRole, isSuperAdminRole, staffHomePath } from "./roles";

export type PreviewSession = {
  isPreviewing: true;
  isReadOnly: true;
  actorUserId: string;
  effectiveUserId: string;
  effectiveRole: string;
  targetEmail: string | null;
  targetName: string | null;
};

export type AppSession = {
  isPreviewing: boolean;
  isReadOnly: boolean;
  actorUserId: string;
  actorRole: string;
  effectiveUserId: string;
  effectiveRole: string | null;
  preview: PreviewSession | null;
};

export async function getAppSession(): Promise<AppSession | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { profile: actorProfile } = await loadAuthUserProfile(supabase);

  if (!actorProfile?.is_active || !isKnownRole(actorProfile.role)) {
    return null;
  }

  const cookieStore = await cookies();
  const previewCookies = readPreviewCookies((name) => cookieStore.get(name)?.value);

  if (
    previewCookies &&
    isSuperAdminRole(actorProfile.role) &&
    previewCookies.actorUserId === user.id &&
    isKnownRole(previewCookies.targetRole)
  ) {
    const preview: PreviewSession = {
      isPreviewing: true,
      isReadOnly: true,
      actorUserId: user.id,
      effectiveUserId: previewCookies.targetUserId,
      effectiveRole: previewCookies.targetRole,
      targetEmail: null,
      targetName: previewCookies.targetName,
    };

    return {
      isPreviewing: true,
      isReadOnly: true,
      actorUserId: user.id,
      actorRole: actorProfile.role,
      effectiveUserId: previewCookies.targetUserId,
      effectiveRole: previewCookies.targetRole,
      preview,
    };
  }

  return {
    isPreviewing: false,
    isReadOnly: false,
    actorUserId: user.id,
    actorRole: actorProfile.role,
    effectiveUserId: user.id,
    effectiveRole: actorProfile.role,
    preview: null,
  };
}

export async function assertNotPreviewMutation() {
  const session = await getAppSession();
  if (session?.isPreviewing) {
    throw new Error("Read-only preview — exit preview to make changes.");
  }
}

/** Super Admin audit preview: show the target user's UI; writes stay blocked. */
export function isAuditPreviewSession(session: AppSession | null | undefined): boolean {
  return Boolean(session?.isPreviewing && isSuperAdminRole(session.actorRole));
}

export function staffAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_STAFF_APP_URL ?? "http://localhost:3000";
  return raw.replace(/\/$/, "");
}

export function clientAppOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_CLIENT_APP_URL ?? "http://localhost:3001";
  return raw.replace(/\/$/, "");
}

export function previewRedirectUrl(role: string): string {
  const r = role.trim().toLowerCase();
  if (r === "client" || r === "support") {
    return `${clientAppOrigin()}/dashboard`;
  }
  return `${staffAppOrigin()}${staffHomePath(r)}`;
}

export {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
};
