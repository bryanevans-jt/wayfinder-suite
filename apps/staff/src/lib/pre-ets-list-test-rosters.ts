import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { buildPreEtsRosterFileLabel } from "@wayfinder/supabase/pre-ets-roster-filename";
import {
  countEligibleRosterStudentsForAuthorization,
  countEligibleRosterStudentsForProgramGroup,
  listAuthorizationIdsForProgramGroup,
} from "@wayfinder/supabase/pre-ets-program-group-roster";
import { pickRepresentativePreEtsAuthorization } from "@wayfinder/supabase/pre-ets-school-pipeline";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

export type PreEtsTestRosterListItem = {
  authorizationId: string;
  fileLabel: string;
  schoolName: string;
  groupName: string;
  authType: string;
  eligibleStudentCount: number;
};

type AuthRow = {
  id: string;
  auth_type: string;
  service_month: string;
  pre_ets_schools:
    | {
        name: string;
        pre_ets_districts: { school_year: string } | { school_year: string }[] | null;
      }
    | {
        name: string;
        pre_ets_districts: { school_year: string } | { school_year: string }[] | null;
      }[]
    | null;
  pre_ets_program_groups:
    | { group_name: string }
    | { group_name: string }[]
    | null;
};

function toListItem(auth: AuthRow, eligibleStudentCount: number): PreEtsTestRosterListItem {
  const school = relationOne(auth.pre_ets_schools);
  const group = relationOne(auth.pre_ets_program_groups);
  const schoolName = school?.name ?? "";
  const groupName = group?.group_name ?? "";
  const district = relationOne(school?.pre_ets_districts ?? null);

  return {
    authorizationId: auth.id,
    fileLabel: buildPreEtsRosterFileLabel({
      schoolYear: district?.school_year ?? null,
      serviceMonth: auth.service_month,
      schoolName: schoolName || "School",
      groupName: groupName || "Group",
    }),
    schoolName,
    groupName,
    authType: auth.auth_type,
    eligibleStudentCount,
  };
}

async function loadAuthorizationRows(
  admin: AdminClient,
  authIds: string[]
): Promise<Map<string, AuthRow>> {
  const unique = [...new Set(authIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const rows = await fetchAllPostgrestRows<AuthRow>(
    admin,
    "pre_ets_authorizations",
    "id, auth_type, service_month, pre_ets_schools(name, pre_ets_districts(school_year)), pre_ets_program_groups(group_name)",
    {
      applyFilters: (q) => q.in("id", unique),
      order: { column: "created_at", ascending: true },
    }
  );

  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Lists exportable test rosters for a billing month. Aligns with Schools & groups:
 * program groups are scoped by service month; roster students may sit on auths linked
 * to those groups even when authorization.service_month differs.
 */
export async function listPreEtsTestRostersForMonth(
  admin: AdminClient,
  serviceMonthInput: string
): Promise<{ serviceMonth: string; rosters: PreEtsTestRosterListItem[] }> {
  const serviceMonth = normalizeServiceMonth(serviceMonthInput);

  const programGroups = await fetchAllPostgrestRows<{
    id: string;
    hidden_at: string | null;
  }>(admin, "pre_ets_program_groups", "id, hidden_at", {
    applyFilters: (q) => q.eq("service_month", serviceMonth),
    order: { column: "created_at", ascending: true },
  });

  const authIdsToLoad: string[] = [];
  const eligibleByAuth = new Map<string, number>();

  for (const programGroup of programGroups) {
    if (programGroup.hidden_at) continue;

    const programGroupId = programGroup.id;
    const scopedAuthIds = await listAuthorizationIdsForProgramGroup(admin, programGroupId);
    authIdsToLoad.push(...scopedAuthIds);

    const programGroupCount = await countEligibleRosterStudentsForProgramGroup(
      admin,
      programGroupId
    );

    let representative: { id: string; auth_type: string } | null = null;
    if (scopedAuthIds.length > 0) {
      const { data: pickRows } = await admin
        .from("pre_ets_authorizations")
        .select("id, auth_type")
        .in("id", scopedAuthIds);
      representative = pickRepresentativePreEtsAuthorization(pickRows ?? []);
    }

    for (const authId of scopedAuthIds) {
      const authCount = await countEligibleRosterStudentsForAuthorization(admin, authId);
      if (authCount > 0) {
        eligibleByAuth.set(authId, authCount);
      }
    }

    if (representative?.id) {
      const repId = representative.id;
      const repType = representative.auth_type;
      const repCount = eligibleByAuth.get(repId) ?? 0;
      if (repCount === 0 && programGroupCount > 0 && (repType === "group" || repType === "pending")) {
        eligibleByAuth.set(repId, programGroupCount);
      }
    } else if (programGroupCount > 0 && scopedAuthIds.length > 0) {
      const fallbackId =
        scopedAuthIds.find((id) => (eligibleByAuth.get(id) ?? 0) > 0) ?? scopedAuthIds[0]!;
      if (!eligibleByAuth.has(fallbackId)) {
        eligibleByAuth.set(fallbackId, programGroupCount);
      }
    }
  }

  const monthScopedAuths = await fetchAllPostgrestRows<{ id: string }>(
    admin,
    "pre_ets_authorizations",
    "id",
    {
      applyFilters: (q) => q.eq("service_month", serviceMonth),
    }
  );
  for (const row of monthScopedAuths) {
    authIdsToLoad.push(row.id);
    if (!eligibleByAuth.has(row.id)) {
      const count = await countEligibleRosterStudentsForAuthorization(admin, row.id);
      if (count > 0) eligibleByAuth.set(row.id, count);
    }
  }

  const authById = await loadAuthorizationRows(admin, authIdsToLoad);
  const rosters: PreEtsTestRosterListItem[] = [];

  for (const [authId, eligibleStudentCount] of eligibleByAuth) {
    if (eligibleStudentCount <= 0) continue;
    const auth = authById.get(authId);
    if (!auth) continue;
    rosters.push(toListItem(auth, eligibleStudentCount));
  }

  rosters.sort(
    (a, b) =>
      a.schoolName.localeCompare(b.schoolName) ||
      a.groupName.localeCompare(b.groupName) ||
      a.fileLabel.localeCompare(b.fileLabel)
  );

  return { serviceMonth, rosters };
}
