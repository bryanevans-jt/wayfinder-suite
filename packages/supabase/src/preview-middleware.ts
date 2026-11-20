import type { NextRequest } from "next/server";
import { readPreviewCookies } from "./preview-cookies";
import { viewAsBlocksMutation } from "./preview-policy";
import { isSuperAdminRole } from "./roles";

export type ResolvedPreview = {
  effectiveRole: string;
  effectiveUserId: string;
  isPreviewReadOnly: boolean;
  demoClientsOnly: boolean;
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
      demoClientsOnly: false,
    };
  }

  return {
    effectiveRole: preview.targetRole,
    effectiveUserId: preview.targetUserId,
    isPreviewReadOnly: true,
    demoClientsOnly: preview.demoClientsOnly,
  };
}

export function isPreviewMutationBlocked(
  request: NextRequest,
  isPreviewReadOnly: boolean
): boolean {
  return viewAsBlocksMutation({
    method: request.method,
    pathname: request.nextUrl.pathname,
    isPreviewReadOnly,
  });
}
