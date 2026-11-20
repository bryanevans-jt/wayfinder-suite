/**
 * Director role scope — derived from staff roles, not assignment tables.
 *
 * - Transition director oversees Transition Instructors, Transition Specialists,
 *   and all Regional Supervisors (plus Pre-ETS surfaces in the app layer).
 * - Vocational director oversees Employment Specialists and all Regional Supervisors.
 * Supervisors report to BOTH directors by role.
 */

import {
  isDirectorRole,
  isReadOnlyStaffRole,
  isTransitionDirectorRole,
  isVocationalDirectorRole,
  normalizeRole,
} from "./roles";

/** Staff roles a Transition Director may view (calendars, caseloads, logs, KRA). */
export const TRANSITION_DIRECTOR_STAFF_ROLES = [
  "instructor",
  "transition_specialist",
  "supervisor",
] as const;

/** Staff roles a Vocational Director may view. */
export const VOCATIONAL_DIRECTOR_STAFF_ROLES = ["es", "supervisor"] as const;

export type TransitionDirectorStaffRole = (typeof TRANSITION_DIRECTOR_STAFF_ROLES)[number];
export type VocationalDirectorStaffRole = (typeof VOCATIONAL_DIRECTOR_STAFF_ROLES)[number];

export function directorVisibleStaffRoles(
  directorRole: string | null | undefined
): readonly string[] {
  if (isTransitionDirectorRole(directorRole)) return TRANSITION_DIRECTOR_STAFF_ROLES;
  if (isVocationalDirectorRole(directorRole)) return VOCATIONAL_DIRECTOR_STAFF_ROLES;
  return [];
}

export function isDirectorVisibleStaffRole(
  directorRole: string | null | undefined,
  staffRole: string | null | undefined
): boolean {
  const staff = normalizeRole(staffRole);
  if (!staff) return false;
  return directorVisibleStaffRoles(directorRole).includes(staff);
}

/** Directors are view-only for casework mutations. */
export function directorCanMutateCasework(role: string | null | undefined): boolean {
  if (isDirectorRole(role)) return false;
  if (isReadOnlyStaffRole(role)) return false;
  return true;
}

/** Admin-only areas directors must never enter. */
export const DIRECTOR_BLOCKED_PATH_PREFIXES = [
  "/dashboard/super-admin",
  "/dashboard/admin",
  "/dashboard/hr",
  "/dashboard/audit",
  "/dashboard/ijp-billing",
  "/dashboard/intake-billing",
  "/dashboard/exports",
  "/dashboard/operations",
  "/dashboard/compliance",
  "/dashboard/analytics",
  "/dashboard/intake-snapshot",
  "/dashboard/referrals",
  "/dashboard/intake",
  "/dashboard/hospitality",
  "/dashboard/wrt",
  "/api/admin",
  "/api/super-admin",
  "/api/portal",
  "/api/ijp-billing",
  "/api/exports",
] as const;

export function isDirectorBlockedStaffPath(pathname: string): boolean {
  return DIRECTOR_BLOCKED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Paths directors may open (GET). Anything else under /dashboard or /api is blocked. */
export const DIRECTOR_ALLOWED_PATH_PREFIXES = [
  "/dashboard/director",
  "/dashboard/clients",
  "/dashboard/billable-hours",
  "/dashboard/messages",
  "/dashboard/pre-ets",
  "/dashboard/team",
  "/dashboard/core-four",
  "/dashboard/share-moments",
  "/dashboard/help",
  "/dashboard/feedback",
  "/dashboard/profile",
  "/dashboard/pto",
  "/dashboard/rendezvous",
  "/api/pre-ets",
  "/api/pre-ets-access",
  "/api/staff-pto",
  "/api/feedback",
  "/api/profile",
  "/api/team-directory",
  "/api/team-moments",
  "/api/notifications",
  "/api/messages",
  "/api/es",
  "/api/clients",
  "/api/billable-hours",
  "/api/auth",
  "/api/preview",
  "/api/health",
] as const;

export function isDirectorAllowedStaffPath(
  pathname: string,
  role: string | null | undefined
): boolean {
  if (!isDirectorRole(role)) return true;
  if (pathname === "/dashboard" || pathname === "/") return true;
  if (pathname.startsWith("/walkthrough") || pathname.startsWith("/login") || pathname.startsWith("/auth")) {
    return true;
  }
  if (isDirectorBlockedStaffPath(pathname)) return false;
  // Vocational directors do not get Pre-ETS.
  if (
    isVocationalDirectorRole(role) &&
    (pathname.startsWith("/dashboard/pre-ets") || pathname.startsWith("/api/pre-ets"))
  ) {
    return false;
  }
  const underStaffApp =
    pathname.startsWith("/dashboard") || pathname.startsWith("/api/");
  if (!underStaffApp) return true;
  return DIRECTOR_ALLOWED_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

/** Safe HTTP methods for read-only directors (mutations blocked server-side). */
export function isReadOnlySafeHttpMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

export function readOnlyMutationAllowedPath(pathname: string): boolean {
  // Auth / session lifecycle only.
  return (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/preview/stop") ||
    pathname.startsWith("/api/preview/handoff") ||
    pathname === "/api/health"
  );
}
