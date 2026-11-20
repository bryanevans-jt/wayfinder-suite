import { isSuperAdminRole, isViewAsStaffRole, roleDisplayName } from "./roles";

/** Pure: only Super Admin actors may start or manage View as. */
export function canUseViewAsPreview(actorRole: string | null | undefined): boolean {
  return isSuperAdminRole(actorRole);
}

/** Pure: staff View as targets are limited to the owner-approved role list. */
export function canViewAsTargetRole(targetRole: string | null | undefined): boolean {
  return isViewAsStaffRole(targetRole);
}

/**
 * Pure: whether a mutating HTTP request must be rejected in View as.
 * Allows GET/HEAD and the stop endpoint only.
 */
export function viewAsBlocksMutation(opts: {
  method: string;
  pathname: string;
  isPreviewReadOnly: boolean;
}): boolean {
  if (!opts.isPreviewReadOnly) return false;
  const method = opts.method.toUpperCase();
  if (method === "GET" || method === "HEAD") return false;
  if (opts.pathname === "/api/preview/stop") return false;
  return true;
}

/** Pure: optional demo-clients-only filter for preview sessions. */
export function applyDemoClientsOnlyFilter<T extends { is_demo?: boolean | null }>(
  rows: T[],
  demoClientsOnly: boolean
): T[] {
  if (demoClientsOnly) {
    return rows.filter((c) => c.is_demo === true);
  }
  return rows.filter((c) => c.is_demo !== true);
}

/** Pure: when demo-only is on, non-demo clients are not visible in preview. */
export function previewMayViewClient(opts: {
  demoClientsOnly: boolean;
  clientIsDemo: boolean | null | undefined;
}): boolean {
  if (!opts.demoClientsOnly) return true;
  return opts.clientIsDemo === true;
}

export function viewAsBannerCopy(opts: {
  targetName: string;
  targetRole: string;
  demoClientsOnly?: boolean;
}): string {
  const roleLabel = roleDisplayName(opts.targetRole);
  const base = `Viewing as ${opts.targetName} (${roleLabel}) — read-only`;
  if (opts.demoClientsOnly) {
    return `${base} · demo clients only`;
  }
  return base;
}
