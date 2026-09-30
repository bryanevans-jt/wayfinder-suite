import {
  canAccessPreEtsAccounts,
  canDeliverPreEtsSessions,
  canSupervisePreEts,
  preEtsWorksheetTestingOverrideActive,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { isPreEtsAuthorizationReleasedToField } from "@wayfinder/supabase/pre-ets-release";
import { isAdminRole, isSuperAdminRole } from "@wayfinder/supabase/roles";

export type PreEtsReleaseGateSettings = Pick<
  PreEtsSettingsRow,
  "module_enabled" | "enabled_roles" | "worksheet_testing_override_enabled"
>;

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
  return preEtsFieldReleaseGateApplies(role, settings) || preEtsUnreleasedRosterHiddenFromRole(role, settings);
}

export function isPreEtsAuthorizationVisibleToRole(
  auth: { auth_number: string | null; auth_type: string } | null | undefined,
  role: string,
  settings: PreEtsReleaseGateSettings
): boolean {
  if (!preEtsReleasedAuthorizationGateApplies(role, settings)) return true;
  return isPreEtsAuthorizationReleasedToField(auth);
}

export function filterAuthorizationsForFieldGate<
  T extends { auth_number: string | null; auth_type: string },
>(rows: T[], gateApplies: boolean): T[] {
  if (!gateApplies) return rows;
  return rows.filter((row) => isPreEtsAuthorizationReleasedToField(row));
}

export function filterProgramGroupsForFieldGate<
  T extends {
    pre_ets_authorizations?:
      | { auth_number: string | null; auth_type: string }
      | { auth_number: string | null; auth_type: string }[]
      | null;
  },
>(groups: T[], gateApplies: boolean): T[] {
  if (!gateApplies) return groups;
  return groups.filter((group) => {
    const auths = group.pre_ets_authorizations;
    const list = Array.isArray(auths) ? auths : auths ? [auths] : [];
    return list.some((a) => isPreEtsAuthorizationReleasedToField(a));
  });
}

export function filterSessionsForFieldGate<
  T extends {
    pre_ets_authorizations?:
      | { auth_number: string | null; auth_type: string }
      | { auth_number: string | null; auth_type: string }[]
      | null;
  },
>(sessions: T[], gateApplies: boolean): T[] {
  if (!gateApplies) return sessions;
  return sessions.filter((session) => {
    const auth = session.pre_ets_authorizations;
    const row = Array.isArray(auth) ? auth[0] : auth;
    return isPreEtsAuthorizationReleasedToField(row ?? null);
  });
}
