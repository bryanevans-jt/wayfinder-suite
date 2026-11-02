import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canAccessPreEts,
  loadPreEtsSettings,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { isSuperAdminRole, staffHomePath } from "@wayfinder/supabase/roles";
import { unstable_cache } from "next/cache";
import {
  isPreEtsApiPath,
  isPreEtsDashboardPath,
  PRE_ETS_API_PREFIX,
  PRE_ETS_PATH_PREFIX,
} from "./pre-ets-middleware-access";

export {
  isPreEtsApiPath,
  isPreEtsDashboardPath,
  PRE_ETS_API_PREFIX,
  PRE_ETS_PATH_PREFIX,
};
export const PRE_ETS_SETTINGS_CACHE_TAG = "pre-ets-settings";

export const loadCachedPreEtsSettings = unstable_cache(
  async (): Promise<PreEtsSettingsRow> =>
    loadPreEtsSettings(createServiceRoleClient()),
  ["pre-ets-settings-v1"],
  { revalidate: 30, tags: [PRE_ETS_SETTINGS_CACHE_TAG] }
);

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
  const settings = await loadCachedPreEtsSettings();
  return canAccessPreEts(role, settings);
}

export function preEtsDeniedRedirectPath(role: string | null | undefined): string {
  return staffHomePath(role);
}
