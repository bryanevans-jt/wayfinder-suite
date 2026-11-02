import { isPreEtsRolloutRole } from "@wayfinder/supabase/pre-ets-settings";
import { isSuperAdminRole, normalizeRole } from "@wayfinder/supabase/roles";

export const PRE_ETS_PATH_PREFIX = "/dashboard/pre-ets";
export const PRE_ETS_API_PREFIX = "/api/pre-ets";

export function isPreEtsDashboardPath(pathname: string): boolean {
  return pathname === PRE_ETS_PATH_PREFIX || pathname.startsWith(`${PRE_ETS_PATH_PREFIX}/`);
}

export function isPreEtsApiPath(pathname: string): boolean {
  return pathname === PRE_ETS_API_PREFIX || pathname.startsWith(`${PRE_ETS_API_PREFIX}/`);
}

/** Edge-only coarse gate. Pages and API routes enforce settings-driven access. */
export function preEtsMiddlewareAccessAllowed(
  role: string | null | undefined
): boolean {
  if (isSuperAdminRole(role)) return true;
  const normalized = normalizeRole(role);
  return Boolean(normalized && isPreEtsRolloutRole(normalized));
}
