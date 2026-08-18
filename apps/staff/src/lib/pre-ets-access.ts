import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canAccessPreEts, loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { isSuperAdminRole, staffHomePath } from "@wayfinder/supabase/roles";

export const PRE_ETS_PATH_PREFIX = "/dashboard/pre-ets";
export const PRE_ETS_API_PREFIX = "/api/pre-ets";

export function isPreEtsDashboardPath(pathname: string): boolean {
  return pathname === PRE_ETS_PATH_PREFIX || pathname.startsWith(`${PRE_ETS_PATH_PREFIX}/`);
}

export function isPreEtsApiPath(pathname: string): boolean {
  return pathname === PRE_ETS_API_PREFIX || pathname.startsWith(`${PRE_ETS_API_PREFIX}/`);
}

export function isPreEtsProtectedPath(pathname: string): boolean {
  return isPreEtsDashboardPath(pathname) || isPreEtsApiPath(pathname);
}

/** Settings API is super-admin-only and handled separately. */
export function isPreEtsAccessApiPath(pathname: string): boolean {
  return pathname === "/api/pre-ets/access";
}

export async function preEtsAccessAllowedForRole(
  role: string | null | undefined
): Promise<boolean> {
  if (isSuperAdminRole(role)) return true;
  const admin = createServiceRoleClient();
  const settings = await loadPreEtsSettings(admin);
  return canAccessPreEts(role, settings);
}

export function preEtsDeniedRedirectPath(role: string | null | undefined): string {
  return staffHomePath(role);
}
