import type { NextRequest } from "next/server";
import { readPreviewCookies } from "./preview-cookies";
import { isSuperAdminRole } from "./roles";

export type ResolvedPreview = {
  effectiveRole: string;
  effectiveUserId: string;
  isPreviewReadOnly: boolean;
};

export function resolvePreviewSession(
  request: NextRequest,
  actorUserId: string,
  actorRole: string
): ResolvedPreview {
  const preview = readPreviewCookies((name) => request.cookies.get(name)?.value);

  if (!preview || !isSuperAdminRole(actorRole) || preview.actorUserId !== actorUserId) {
    return {
      effectiveRole: actorRole,
      effectiveUserId: actorUserId,
      isPreviewReadOnly: false,
    };
  }

  return {
    effectiveRole: preview.targetRole,
    effectiveUserId: preview.targetUserId,
    isPreviewReadOnly: true,
  };
}

export function isPreviewMutationBlocked(
  request: NextRequest,
  isPreviewReadOnly: boolean
): boolean {
  if (!isPreviewReadOnly) {
    return false;
  }
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD") {
    return false;
  }
  const { pathname } = request.nextUrl;
  if (pathname === "/api/preview/stop") {
    return false;
  }
  return true;
}
