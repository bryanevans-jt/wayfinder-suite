import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchAllPostgrestRows,
  fetchAllPostgrestRowsByIn,
} from "./postgrest-fetch-all";
import { hidePreEtsProgramGroup } from "./pre-ets-program-group-visibility";
import { normalizePreEtsServiceMonth } from "./pre-ets-service-month";

/** Pure helper: empty school shells should disappear once that district's month spreadsheet is committed. */
export function shouldOmitEmptySchoolShell(input: {
  districtHasCommittedWorksheet: boolean;
}): boolean {
  return input.districtHasCommittedWorksheet;
}

/** Group has neither an A&I number nor active roster PIDs. */
export function isEmptyPreEtsPipelineGroupShell(input: {
  authNumbers: Array<string | null | undefined>;
  activeStudentCount: number;
}): boolean {
  const hasAuthNumber = input.authNumbers.some((value) => (value ?? "").trim().length > 0);
  return !hasAuthNumber && input.activeStudentCount <= 0;
}

export async function loadDistrictIdsWithCommittedWorksheetImport(
  admin: SupabaseClient,
  serviceMonth: string
): Promise<Set<string>> {
  const month = normalizePreEtsServiceMonth(serviceMonth);
  const rows = await fetchAllPostgrestRows<{ district_id: string }>(
    admin,
    "pre_ets_worksheet_imports",
    "district_id",
    {
      applyFilters: (query) =>
        query.eq("service_month", month).eq("status", "committed"),
    }
  );
  return new Set(rows.map((row) => row.district_id).filter(Boolean));
}

/**
 * Hide program groups for a service month that have no A&I numbers and no active
 * roster students. Never touches groups with students or authorization numbers.
 */
export async function hideEmptyPreEtsProgramGroupsForMonth(
  admin: SupabaseClient,
  input: {
    serviceMonth: string;
    actorUserId: string;
    /** When set, only hide groups whose school is in these districts. */
    districtIds?: string[] | null;
  }
): Promise<{ hidden: number }> {
  const serviceMonth = normalizePreEtsServiceMonth(input.serviceMonth);
  const districtFilter = [...new Set((input.districtIds ?? []).filter(Boolean))];

  let schoolIds: string[] | null = null;
  if (districtFilter.length > 0) {
    const schoolRows = await fetchAllPostgrestRowsByIn<{ id: string }>(
      admin,
      "pre_ets_schools",
      "id",
      "district_id",
      districtFilter
    );
    schoolIds = schoolRows.map((row) => row.id);
    if (schoolIds.length === 0) return { hidden: 0 };
  }

  const groups =
    schoolIds === null
      ? await fetchAllPostgrestRows<{
          id: string;
          school_id: string;
          hidden_at: string | null;
        }>(admin, "pre_ets_program_groups", "id, school_id, hidden_at", {
          applyFilters: (query) =>
            query.eq("service_month", serviceMonth).is("hidden_at", null),
        })
      : await fetchAllPostgrestRowsByIn<{
          id: string;
          school_id: string;
          hidden_at: string | null;
        }>(admin, "pre_ets_program_groups", "id, school_id, hidden_at", "school_id", schoolIds, {
          applyFilters: (query) =>
            query.eq("service_month", serviceMonth).is("hidden_at", null),
        });

  if (groups.length === 0) return { hidden: 0 };

  const groupIds = groups.map((group) => group.id);
  const auths = await fetchAllPostgrestRowsByIn<{
    id: string;
    program_group_id: string;
    auth_number: string | null;
  }>(admin, "pre_ets_authorizations", "id, program_group_id, auth_number", "program_group_id", groupIds);

  const authIdsByGroup = new Map<string, string[]>();
  const authNumbersByGroup = new Map<string, Array<string | null>>();
  for (const auth of auths) {
    const numbers = authNumbersByGroup.get(auth.program_group_id) ?? [];
    numbers.push(auth.auth_number);
    authNumbersByGroup.set(auth.program_group_id, numbers);
    const ids = authIdsByGroup.get(auth.program_group_id) ?? [];
    ids.push(auth.id);
    authIdsByGroup.set(auth.program_group_id, ids);
  }

  const allAuthIds = auths.map((auth) => auth.id);
  const activeCountByAuth = new Map<string, number>();
  if (allAuthIds.length > 0) {
    const roster = await fetchAllPostgrestRowsByIn<{ authorization_id: string }>(
      admin,
      "pre_ets_roster_entries",
      "authorization_id",
      "authorization_id",
      allAuthIds,
      {
        applyFilters: (query) =>
          query.eq("not_approved", false).is("removed_at", null),
      }
    );
    for (const entry of roster) {
      activeCountByAuth.set(
        entry.authorization_id,
        (activeCountByAuth.get(entry.authorization_id) ?? 0) + 1
      );
    }
  }

  let hidden = 0;
  for (const group of groups) {
    const authIds = authIdsByGroup.get(group.id) ?? [];
    const activeStudentCount = authIds.reduce(
      (sum, authId) => sum + (activeCountByAuth.get(authId) ?? 0),
      0
    );
    if (
      !isEmptyPreEtsPipelineGroupShell({
        authNumbers: authNumbersByGroup.get(group.id) ?? [],
        activeStudentCount,
      })
    ) {
      continue;
    }

    const result = await hidePreEtsProgramGroup(
      admin,
      group.id,
      input.actorUserId,
      "Auto-hidden: no PIDs and no A&I after spreadsheet upload"
    );
    if (result.ok) hidden += 1;
  }

  return { hidden };
}
