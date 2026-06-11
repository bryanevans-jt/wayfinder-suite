import {
  isAdminTierRole,
  isCounselorRole,
  isSuperAdminRole,
  isSupervisorTierRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";

const COUNSELOR_BLOCKED_PREFIXES = [
  "/dashboard/clients",
  "/dashboard/community-partners",
  "/dashboard/employer-network",
  "/dashboard/messages",
  "/dashboard/exports",
  "/dashboard/analytics",
  "/dashboard/super-admin",
  "/dashboard/admin",
  "/dashboard/supervisor",
];

const PORTAL_PREFIXES = [
  "/dashboard/super-admin",
  "/dashboard/admin",
  "/dashboard/supervisor",
];

import type { WayfinderNavBadge } from "@wayfinder/branding";

export const COMMUNITY_PARTNERS_PATH = "/dashboard/community-partners";

export function staffNavBadge(role: string | null | undefined): WayfinderNavBadge {
  if (isSuperAdminRole(role)) return "Super admin";
  if (isAdminTierRole(role) && !isSuperAdminRole(role)) return "Admin";
  if (isSupervisorTierRole(role) && !isAdminTierRole(role)) return "Supervisor";
  return isCounselorRole(role) ? "Counselor" : "Staff";
}

export function staffHomeHref(role: string | null | undefined): string {
  return staffHomePath(role);
}

export function isCounselorBlockedStaffPath(pathname: string): boolean {
  return COUNSELOR_BLOCKED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export function portalPathForRole(role: string | null | undefined): string | null {
  if (isSuperAdminRole(role)) return "/dashboard/super-admin";
  if (role === "admin") return "/dashboard/admin";
  if (role === "supervisor") return "/dashboard/supervisor";
  return null;
}

export function isPortalPath(pathname: string): boolean {
  return PORTAL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function portalPathAllowedForRole(
  pathname: string,
  role: string | null | undefined
): boolean {
  if (pathname.startsWith("/dashboard/super-admin")) {
    return isSuperAdminRole(role);
  }
  if (pathname.startsWith("/dashboard/admin")) {
    return isAdminTierRole(role);
  }
  if (pathname.startsWith("/dashboard/supervisor")) {
    return isSupervisorTierRole(role);
  }
  return true;
}

export function showStaffNotifications(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return (
    r === "es" ||
    r === "supervisor" ||
    r === "admin" ||
    r === "super_admin"
  );
}
