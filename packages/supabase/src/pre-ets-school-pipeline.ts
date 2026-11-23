import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreEtsAuthorizationReleasedToField } from "./pre-ets-release";
import {
  fetchAllPostgrestRows,
  fetchAllPostgrestRowsByIn,
} from "./postgrest-fetch-all";
import { normalizePreEtsServiceMonth } from "./pre-ets-service-month";
import { loadPreEtsAssignedSchoolIds } from "./pre-ets-staff-assignments";
import {
  authorizationMatchesProgramGroupHeader,
} from "./pre-ets-program-group-roster";

export type PreEtsPipelineStatus =
  | "awaiting_spreadsheet"
  | "pending_authorization"
  | "roster_submitted";

export type PreEtsPipelineRow = {
  schoolId: string;
  schoolName: string;
  groupName: string;
  programGroupId: string | null;
  authorizationId: string | null;
  serviceMonth: string;
  status: PreEtsPipelineStatus;
  studentCount: number;
  authNumber: string | null;
  authType: string | null;
  fieldReleasedAt: string | null;
  serviceCode: string | null;
  instructorName: string | null;
  classTime: string | null;
  hidden: boolean;
  mergedIntoProgramGroupId: string | null;
  mergedIntoGroupName: string | null;
};

/** Prefer a group/pending auth when a caller still needs a single representative. */
export function pickRepresentativePreEtsAuthorization<
  T extends { auth_type: string },
>(authList: T[]): T | null {
  if (authList.length === 0) return null;
  return (
    authList.find((a) => a.auth_type === "group") ??
    authList.find((a) => a.auth_type === "pending") ??
    authList[0] ??
    null
  );
}

/**
 * Stable order for multiple A&Is under one program group (e.g. Peach 25720 + 25732).
 * Group/pending first, then by auth number, then id.
 */
export function sortPreEtsAuthorizationsForPipeline<
  T extends { id: string; auth_type: string; auth_number: string | null },
>(authList: T[]): T[] {
  const typeRank = (authType: string) => {
    if (authType === "group") return 0;
    if (authType === "pending") return 1;
    return 2;
  };
  return [...authList].sort((a, b) => {
    const byType = typeRank(a.auth_type) - typeRank(b.auth_type);
    if (byType !== 0) return byType;
    const aNum = (a.auth_number ?? "").trim();
    const bNum = (b.auth_number ?? "").trim();
    if (aNum && bNum) {
      const byNum = aNum.localeCompare(bNum, undefined, { numeric: true });
      if (byNum !== 0) return byNum;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1;
    }
    return a.id.localeCompare(b.id);
  });
}

function statusFromAuth(
  auth: {
    auth_number: string | null;
    auth_type: string;
    field_released_at?: string | null;
  } | null,
  studentCount: number
): PreEtsPipelineStatus {
  if (!auth || studentCount === 0) {
    return "awaiting_spreadsheet";
  }
  if (isPreEtsAuthorizationReleasedToField(auth)) {
    return "roster_submitted";
  }
  return "pending_authorization";
}

export async function loadPreEtsSchoolPipeline(
  admin: SupabaseClient,
  input: {
    userId: string;
    role: string;
    serviceMonth: string;
    includeHidden?: boolean;
  }
): Promise<PreEtsPipelineRow[]> {
  const serviceMonth = normalizePreEtsServiceMonth(input.serviceMonth);
  const scopedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, input.userId, input.role);

  if (scopedSchoolIds !== null && scopedSchoolIds.length === 0) {
    return [];
  }

  const schools =
    scopedSchoolIds === null
      ? await fetchAllPostgrestRows<{ id: string; name: string }>(
          admin,
          "pre_ets_schools",
          "id, name",
          { order: { column: "name", ascending: true } }
        )
      : await fetchAllPostgrestRowsByIn<{ id: string; name: string }>(
          admin,
          "pre_ets_schools",
          "id, name",
          "id",
          scopedSchoolIds,
          { order: { column: "name", ascending: true } }
        );

  const rows: PreEtsPipelineRow[] = [];

  const schoolIds = schools.map((school) => school.id);
  if (schoolIds.length === 0) return [];

  type PipelineGroup = {
    id: string;
    school_id: string;
    group_name: string | null;
    instructor_name: string | null;
    class_time: string | null;
    service_code: string | null;
    hidden_at: string | null;
    merged_into_program_group_id: string | null;
    header_raw: string | null;
    worksheet_header_key: string | null;
    pre_ets_authorizations:
      | {
          id: string;
          auth_number: string | null;
          auth_type: string;
          field_released_at: string | null;
          service_code: string;
          worksheet_header_key: string | null;
        }
      | {
          id: string;
          auth_number: string | null;
          auth_type: string;
          field_released_at: string | null;
          service_code: string;
          worksheet_header_key: string | null;
        }[]
      | null;
  };

  const groups = await fetchAllPostgrestRowsByIn<PipelineGroup>(
    admin,
    "pre_ets_program_groups",
    "id, school_id, group_name, instructor_name, class_time, service_code, hidden_at, merged_into_program_group_id, header_raw, worksheet_header_key, pre_ets_authorizations(id, auth_number, auth_type, field_released_at, service_code, worksheet_header_key)",
    "school_id",
    schoolIds,
    {
      applyFilters: (query) => {
        let filtered = query.eq("service_month", serviceMonth);
        if (!input.includeHidden) filtered = filtered.is("hidden_at", null);
        return filtered;
      },
    }
  );

  type PipelineAuth = {
    id: string;
    auth_number: string | null;
    auth_type: string;
    field_released_at: string | null;
    service_code: string;
    worksheet_header_key: string | null;
  };

  const groupsBySchool = new Map<string, PipelineGroup[]>();
  /** Every header-matching A&I for a program group (not just one representative). */
  const authsByGroup = new Map<string, PipelineAuth[]>();
  for (const group of groups) {
    const current = groupsBySchool.get(group.school_id) ?? [];
    current.push(group);
    groupsBySchool.set(group.school_id, current);

    const authsRaw = group.pre_ets_authorizations;
    const authList = Array.isArray(authsRaw) ? authsRaw : authsRaw ? [authsRaw] : [];
    const headerMeta = {
      worksheet_header_key: group.worksheet_header_key,
      header_raw: String(group.header_raw ?? ""),
    };
    const matching = sortPreEtsAuthorizationsForPipeline(
      authList.filter((auth) =>
        authorizationMatchesProgramGroupHeader(headerMeta, auth.worksheet_header_key)
      )
    );
    authsByGroup.set(group.id, matching);
  }

  const pipelineAuthIds = [
    ...new Set([...authsByGroup.values()].flatMap((list) => list.map((auth) => auth.id))),
  ];
  const rosterCountsByAuthorization = new Map<string, number>();
  if (pipelineAuthIds.length > 0) {
    const rosterEntries = await fetchAllPostgrestRowsByIn<{
      authorization_id: string;
    }>(
      admin,
      "pre_ets_roster_entries",
      "authorization_id",
      "authorization_id",
      pipelineAuthIds,
      {
        applyFilters: (query) =>
          query.eq("not_approved", false).is("removed_at", null),
      }
    );
    for (const entry of rosterEntries) {
      rosterCountsByAuthorization.set(
        entry.authorization_id,
        (rosterCountsByAuthorization.get(entry.authorization_id) ?? 0) + 1
      );
    }
  }

  const mergeTargetIds = [
    ...new Set(
      groups
        .map((group) => group.merged_into_program_group_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const mergeTargetNames = new Map<string, string>();
  if (mergeTargetIds.length > 0) {
    const targets = await fetchAllPostgrestRowsByIn<{
      id: string;
      group_name: string;
    }>(
      admin,
      "pre_ets_program_groups",
      "id, group_name",
      "id",
      mergeTargetIds
    );
    for (const target of targets) {
      mergeTargetNames.set(target.id as string, target.group_name as string);
    }
  }

  for (const school of schools) {
    const schoolId = school.id;
    const schoolName = school.name;
    const visibleGroups = groupsBySchool.get(schoolId) ?? [];

    if (!visibleGroups.length) {
      rows.push({
        schoolId,
        schoolName,
        groupName: schoolName,
        programGroupId: null,
        authorizationId: null,
        serviceMonth,
        status: "awaiting_spreadsheet",
        studentCount: 0,
        authNumber: null,
        authType: null,
        fieldReleasedAt: null,
        serviceCode: null,
        instructorName: null,
        classTime: null,
        hidden: false,
        mergedIntoProgramGroupId: null,
        mergedIntoGroupName: null,
      });
      continue;
    }

    for (const group of visibleGroups) {
      const matchingAuths = authsByGroup.get(group.id) ?? [];
      const mergedIntoId = (group.merged_into_program_group_id as string | null) ?? null;
      const mergedIntoGroupName = mergedIntoId
        ? mergeTargetNames.get(mergedIntoId) ?? null
        : null;
      const base = {
        schoolId,
        schoolName,
        groupName: (group.group_name as string) || schoolName,
        programGroupId: group.id,
        serviceMonth,
        instructorName: (group.instructor_name as string | null) ?? null,
        classTime: (group.class_time as string | null) ?? null,
        hidden: Boolean(group.hidden_at),
        mergedIntoProgramGroupId: mergedIntoId,
        mergedIntoGroupName,
      };

      // One Schools & groups row per A&I so multi-auth schools (e.g. Peach) are not collapsed.
      if (matchingAuths.length === 0) {
        rows.push({
          ...base,
          authorizationId: null,
          status: "awaiting_spreadsheet",
          studentCount: 0,
          authNumber: null,
          authType: null,
          fieldReleasedAt: null,
          serviceCode: (group.service_code as string) ?? null,
        });
        continue;
      }

      for (const auth of matchingAuths) {
        const studentCount = rosterCountsByAuthorization.get(auth.id) ?? 0;
        rows.push({
          ...base,
          authorizationId: auth.id,
          status: statusFromAuth(auth, studentCount),
          studentCount,
          authNumber: auth.auth_number ?? null,
          authType: auth.auth_type ?? null,
          fieldReleasedAt: auth.field_released_at ?? null,
          serviceCode: (auth.service_code as string) ?? (group.service_code as string) ?? null,
        });
      }
    }
  }

  return rows.sort((a, b) => {
    const bySchool = a.schoolName.localeCompare(b.schoolName);
    if (bySchool !== 0) return bySchool;
    const byGroup = a.groupName.localeCompare(b.groupName);
    if (byGroup !== 0) return byGroup;
    const aNum = (a.authNumber ?? "").trim();
    const bNum = (b.authNumber ?? "").trim();
    if (aNum && bNum) {
      const byAuth = aNum.localeCompare(bNum, undefined, { numeric: true });
      if (byAuth !== 0) return byAuth;
    } else if (aNum !== bNum) {
      return aNum ? -1 : 1;
    }
    return (a.authorizationId ?? "").localeCompare(b.authorizationId ?? "");
  });
}

export function preEtsPipelineStatusLabel(status: PreEtsPipelineStatus): string {
  switch (status) {
    case "awaiting_spreadsheet":
      return "Awaiting spreadsheet";
    case "pending_authorization":
      return "Pending authorization";
    case "roster_submitted":
      return "Roster submitted";
  }
}

export type PipelineListControls = {
  search?: string;
  status?: PreEtsPipelineStatus | "all";
  page?: number;
  pageSize?: number;
};

export type PaginatedPipelineResult = {
  rows: PreEtsPipelineRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function matchesSearch(row: PreEtsPipelineRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    row.schoolName,
    row.groupName,
    row.authNumber ?? "",
    row.serviceCode ?? "",
    row.instructorName ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function paginatePreEtsPipelineRows(
  rows: PreEtsPipelineRow[],
  controls: PipelineListControls
): PaginatedPipelineResult {
  const pageSize = Math.min(100, Math.max(5, controls.pageSize ?? 25));
  const page = Math.max(1, controls.page ?? 1);
  const status = controls.status ?? "all";

  let filtered = rows;
  if (status !== "all") {
    filtered = filtered.filter((row) => row.status === status);
  }
  if (controls.search?.trim()) {
    filtered = filtered.filter((row) => matchesSearch(row, controls.search!));
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: filtered.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
  };
}
