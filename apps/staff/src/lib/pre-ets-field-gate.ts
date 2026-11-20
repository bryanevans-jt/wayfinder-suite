import {
  canAccessPreEtsAccounts,
  canDeliverPreEtsSessions,
  canSupervisePreEts,
  preEtsWorksheetTestingOverrideActive,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import {
  isPreEtsAuthorizationReleasedToField,
  type PreEtsAuthorizationReleaseFields,
} from "@wayfinder/supabase/pre-ets-release";
import { isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";

export type PreEtsReleaseGateSettings = Pick<
  PreEtsSettingsRow,
  "module_enabled" | "enabled_roles" | "worksheet_testing_override_enabled"
>;

export type PreEtsFieldAuthRow = PreEtsAuthorizationReleaseFields & {
  service_month?: string | null;
};

/** While testing override is on, only admin / super_admin may view unreleased rosters. */
export function preEtsUnreleasedRosterHiddenFromRole(
  role: string,
  settings: Pick<PreEtsSettingsRow, "worksheet_testing_override_enabled">
): boolean {
  if (!preEtsWorksheetTestingOverrideActive(settings)) return false;
  return !isSuperAdminRole(role) && !isAdminRole(role);
}

export function preEtsFieldReleaseGateApplies(
  role: string,
  settings: Pick<PreEtsSettingsRow, "module_enabled" | "enabled_roles">
): boolean {
  if (isSuperAdminRole(role)) return false;
  if (canSupervisePreEts(role, settings)) return false;
  if (canAccessPreEtsAccounts(role, settings)) return false;
  return canDeliverPreEtsSessions(role, settings);
}

/** Hide unreleased authorizations from field staff and, during testing override, from non-admins. */
export function preEtsReleasedAuthorizationGateApplies(
  role: string,
  settings: PreEtsReleaseGateSettings
): boolean {
  return (
    preEtsFieldReleaseGateApplies(role, settings) ||
    preEtsUnreleasedRosterHiddenFromRole(role, settings)
  );
}

function serviceMonthKey(raw: string | null | undefined): string {
  return (raw ?? "").slice(0, 10);
}

export function isPreEtsAuthorizationVisibleToRole(
  auth: PreEtsFieldAuthRow | null | undefined,
  role: string,
  settings: PreEtsReleaseGateSettings,
  blockedServiceMonths?: ReadonlySet<string>
): boolean {
  if (!preEtsReleasedAuthorizationGateApplies(role, settings)) return true;
  if (!isPreEtsAuthorizationReleasedToField(auth)) return false;
  if (blockedServiceMonths && blockedServiceMonths.size > 0) {
    const key = serviceMonthKey(auth?.service_month);
    if (key && blockedServiceMonths.has(key)) return false;
  }
  return true;
}

export function filterAuthorizationsForFieldGate<T extends PreEtsFieldAuthRow>(
  rows: T[],
  gateApplies: boolean,
  blockedServiceMonths?: ReadonlySet<string>
): T[] {
  if (!gateApplies) return rows;
  return rows.filter((row) => {
    if (!isPreEtsAuthorizationReleasedToField(row)) return false;
    if (blockedServiceMonths && blockedServiceMonths.size > 0) {
      const key = serviceMonthKey(row.service_month);
      if (key && blockedServiceMonths.has(key)) return false;
    }
    return true;
  });
}

export function filterProgramGroupsForFieldGate<
  T extends {
    pre_ets_authorizations?:
      | PreEtsFieldAuthRow
      | PreEtsFieldAuthRow[]
      | null;
  },
>(
  groups: T[],
  gateApplies: boolean,
  blockedServiceMonths?: ReadonlySet<string>
): T[] {
  if (!gateApplies) return groups;
  return groups.filter((group) => {
    const auths = group.pre_ets_authorizations;
    const list = Array.isArray(auths) ? auths : auths ? [auths] : [];
    return list.some((a) => {
      if (!isPreEtsAuthorizationReleasedToField(a)) return false;
      if (blockedServiceMonths && blockedServiceMonths.size > 0) {
        const key = serviceMonthKey(a.service_month);
        if (key && blockedServiceMonths.has(key)) return false;
      }
      return true;
    });
  });
}

export function filterSessionsForFieldGate<
  T extends {
    pre_ets_authorizations?:
      | PreEtsFieldAuthRow
      | PreEtsFieldAuthRow[]
      | null;
  },
>(
  sessions: T[],
  gateApplies: boolean,
  blockedServiceMonths?: ReadonlySet<string>
): T[] {
  if (!gateApplies) return sessions;
  return sessions.filter((session) => {
    const auth = session.pre_ets_authorizations;
    const row = Array.isArray(auth) ? auth[0] : auth;
    if (!isPreEtsAuthorizationReleasedToField(row ?? null)) return false;
    if (blockedServiceMonths && blockedServiceMonths.size > 0) {
      const key = serviceMonthKey(row?.service_month);
      if (key && blockedServiceMonths.has(key)) return false;
    }
    return true;
  });
}
