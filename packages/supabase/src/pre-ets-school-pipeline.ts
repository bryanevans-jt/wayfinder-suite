import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreEtsAuthorizationReleasedToField } from "./pre-ets-release";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";
import { loadPreEtsAssignedSchoolIds } from "./pre-ets-upload-scope";
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
  serviceCode: string | null;
  instructorName: string | null;
  classTime: string | null;
  hidden: boolean;
  mergedIntoProgramGroupId: string | null;
  mergedIntoGroupName: string | null;
};

function normalizeServiceMonth(month: string): string {
  return month.length === 7 ? `${month}-01` : month.slice(0, 10);
}

/** Same auth pick as Schools & groups (group/pending authorization when present). */
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

function statusFromAuth(
  auth: { auth_number: string | null; auth_type: string } | null,
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
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);
  const scopedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, input.userId, input.role);

  if (scopedSchoolIds !== null && scopedSchoolIds.length === 0) {
    return [];
  }

  const schools = await fetchAllPostgrestRows<{ id: string; name: string }>(
    admin,
    "pre_ets_schools",
    "id, name",
    {
      order: { column: "name", ascending: true },
      applyFilters: (query) => {
        if (scopedSchoolIds !== null) {
          return query.in("id", scopedSchoolIds);
        }
        return query;
      },
    }
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
          service_code: string;
          worksheet_header_key: string | null;
        }
      | {
          id: string;
          auth_number: string | null;
          auth_type: string;
          service_code: string;
          worksheet_header_key: string | null;
        }[]
      | null;
  };

  const groups = await fetchAllPostgrestRows<PipelineGroup>(
    admin,
    "pre_ets_program_groups",
    "id, school_id, group_name, instructor_name, class_time, service_code, hidden_at, merged_into_program_group_id, header_raw, worksheet_header_key, pre_ets_authorizations(id, auth_number, auth_type, service_code, worksheet_header_key)",
    {
      applyFilters: (query) => {
        let filtered = query.in("school_id", schoolIds).eq("service_month", serviceMonth);
        if (!input.includeHidden) filtered = filtered.is("hidden_at", null);
        return filtered;
      },
    }
  );

  const groupsBySchool = new Map<string, PipelineGroup[]>();
  const representativeAuthByGroup = new Map<
    string,
    {
      id: string;
      auth_number: string | null;
      auth_type: string;
      service_code: string;
      worksheet_header_key: string | null;
    } | null
  >();
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
    representativeAuthByGroup.set(
      group.id,
      pickRepresentativePreEtsAuthorization(
        authList.filter((auth) =>
          authorizationMatchesProgramGroupHeader(
            headerMeta,
            auth.worksheet_header_key
          )
        )
      )
    );
  }

  const representativeAuthIds = [
    ...new Set(
      [...representativeAuthByGroup.values()]
        .map((auth) => auth?.id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const rosterCountsByAuthorization = new Map<string, number>();
  if (representativeAuthIds.length > 0) {
    const rosterEntries = await fetchAllPostgrestRows<{
      authorization_id: string;
    }>(
      admin,
      "pre_ets_roster_entries",
      "authorization_id",
      {
        applyFilters: (query) =>
          query
            .in("authorization_id", representativeAuthIds)
            .eq("not_approved", false),
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
    const { data: targets } = await admin
      .from("pre_ets_program_groups")
      .select("id, group_name")
      .in("id", mergeTargetIds);
    for (const target of targets ?? []) {
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
      const auth = representativeAuthByGroup.get(group.id) ?? null;
      const studentCount = auth?.id
        ? (rosterCountsByAuthorization.get(auth.id) ?? 0)
        : 0;

      const mergedIntoId = (group.merged_into_program_group_id as string | null) ?? null;

      rows.push({
        schoolId,
        schoolName,
        groupName: (group.group_name as string) || schoolName,
        programGroupId: group.id,
        authorizationId: auth?.id ?? null,
        serviceMonth,
        status: statusFromAuth(auth, studentCount),
        studentCount,
        authNumber: auth?.auth_number ?? null,
        authType: auth?.auth_type ?? null,
        serviceCode: (auth?.service_code as string) ?? (group.service_code as string) ?? null,
        instructorName: (group.instructor_name as string | null) ?? null,
        classTime: (group.class_time as string | null) ?? null,
        hidden: Boolean(group.hidden_at),
        mergedIntoProgramGroupId: mergedIntoId,
        mergedIntoGroupName: mergedIntoId ? mergeTargetNames.get(mergedIntoId) ?? null : null,
      });
    }
  }

  return rows.sort((a, b) => a.schoolName.localeCompare(b.schoolName));
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
