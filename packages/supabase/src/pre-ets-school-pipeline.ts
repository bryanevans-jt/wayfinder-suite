import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreEtsAuthorizationReleasedToField } from "./pre-ets-release";
import { loadPreEtsAssignedSchoolIds } from "./pre-ets-upload-scope";

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
};

function normalizeServiceMonth(month: string): string {
  return month.length === 7 ? `${month}-01` : month.slice(0, 10);
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
  }
): Promise<PreEtsPipelineRow[]> {
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);
  const scopedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, input.userId, input.role);

  let schoolsQuery = admin
    .from("pre_ets_schools")
    .select("id, name")
    .order("name", { ascending: true });

  if (scopedSchoolIds !== null) {
    if (scopedSchoolIds.length === 0) return [];
    schoolsQuery = schoolsQuery.in("id", scopedSchoolIds);
  }

  const { data: schools, error: schoolErr } = await schoolsQuery;
  if (schoolErr) throw new Error(schoolErr.message);

  const rows: PreEtsPipelineRow[] = [];

  for (const school of schools ?? []) {
    const schoolId = school.id as string;
    const schoolName = school.name as string;

    const { data: groups } = await admin
      .from("pre_ets_program_groups")
      .select(
        "id, group_name, instructor_name, class_time, service_code, pre_ets_authorizations(id, auth_number, auth_type, service_code)"
      )
      .eq("school_id", schoolId)
      .eq("service_month", serviceMonth);

    if (!groups?.length) {
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
      });
      continue;
    }

    for (const group of groups) {
      const authsRaw = group.pre_ets_authorizations as
        | { id: string; auth_number: string | null; auth_type: string; service_code: string }
        | { id: string; auth_number: string | null; auth_type: string; service_code: string }[]
        | null;
      const authList = Array.isArray(authsRaw) ? authsRaw : authsRaw ? [authsRaw] : [];
      const auth =
        authList.find((a) => a.auth_type === "group" || a.auth_type === "pending") ??
        authList[0] ??
        null;

      let studentCount = 0;
      if (auth?.id) {
        const { count } = await admin
          .from("pre_ets_roster_entries")
          .select("id", { count: "exact", head: true })
          .eq("authorization_id", auth.id)
          .eq("not_approved", false);
        studentCount = count ?? 0;
      }

      rows.push({
        schoolId,
        schoolName,
        groupName: (group.group_name as string) || schoolName,
        programGroupId: group.id as string,
        authorizationId: auth?.id ?? null,
        serviceMonth,
        status: statusFromAuth(auth, studentCount),
        studentCount,
        authNumber: auth?.auth_number ?? null,
        authType: auth?.auth_type ?? null,
        serviceCode: (auth?.service_code as string) ?? (group.service_code as string) ?? null,
        instructorName: (group.instructor_name as string | null) ?? null,
        classTime: (group.class_time as string | null) ?? null,
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
