import { cookies } from "next/headers";
import { createClient } from "./server";
import {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
  readPreviewCookies,
} from "./preview-cookies";
import { isKnownRole, isSuperAdminRole } from "./roles";

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

  const { data: actorProfile } = await supabase
    .from("profiles")
    .select("role, is_active, full_name")
    .eq("id", user.id)
    .maybeSingle();

  if (!actorProfile?.is_active || !isKnownRole(actorProfile.role)) {
    return null;
  }

  const cookieStore = await cookies();
  const previewCookies = readPreviewCookies((name) => cookieStore.get(name)?.value);

  if (
    previewCookies &&
    isSuperAdminRole(actorProfile.role) &&
    previewCookies.actorUserId === user.id
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
  if (r === "counselor") {
    return `${staffAppOrigin()}/dashboard/counselor`;
  }
  if (r === "super_admin") {
    return `${staffAppOrigin()}/dashboard/super-admin`;
  }
  if (r === "admin") {
    return `${staffAppOrigin()}/dashboard/admin`;
  }
  if (r === "supervisor") {
    return `${staffAppOrigin()}/dashboard/supervisor`;
  }
  if (r === "es" || r === "accountant") {
    return `${staffAppOrigin()}/dashboard/clients`;
  }
  return `${staffAppOrigin()}/dashboard`;
}

export {
  PREVIEW_ACTOR_COOKIE,
  PREVIEW_NAME_COOKIE,
  PREVIEW_ROLE_COOKIE,
  PREVIEW_TARGET_COOKIE,
};
