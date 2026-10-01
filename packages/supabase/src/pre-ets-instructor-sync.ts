import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignPreEtsPrimaryInstructorFromWorksheet,
  resolvePreEtsStaffProfileByName,
  PRE_ETS_WORKSHEET_INSTRUCTOR_ROLES,
  replacePreEtsPrimaryInstructorForSchool,
} from "./pre-ets-instructor-match";

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

export type SpreadsheetAssignmentSyncResult = {
  /** Program groups scanned (with an instructor name on the row). */
  processed: number;
  /** Schools that received an updated primary assignment. */
  schoolsUpdated: number;
  /** Spreadsheet instructor names with no Transition Specialist / Instructor profile (ignored). */
  namesIgnored: number;
};

/**
 * Set Staff school assignments (primary) from worksheet program-group instructor names.
 * Unmatched names are skipped silently; matched names replace the school's primary assignee.
 */
export async function syncPreEtsSchoolAssignmentsFromSpreadsheet(
  admin: SupabaseClient,
  input: { serviceMonth: string; districtId?: string | null }
): Promise<SpreadsheetAssignmentSyncResult> {
  const serviceMonth = normalizeServiceMonth(input.serviceMonth);

  let schoolIds: string[] | null = null;
  if (input.districtId?.trim()) {
    const { data: schools, error: schoolErr } = await admin
      .from("pre_ets_schools")
      .select("id")
      .eq("district_id", input.districtId.trim());
    if (schoolErr) throw new Error(schoolErr.message);
    schoolIds = (schools ?? []).map((s) => s.id as string);
    if (schoolIds.length === 0) {
      return { processed: 0, schoolsUpdated: 0, namesIgnored: 0 };
    }
  }

  let query = admin
    .from("pre_ets_program_groups")
    .select("id, school_id, group_name, instructor_name, service_month, created_at")
    .eq("service_month", serviceMonth)
    .not("instructor_name", "is", null)
    .order("created_at", { ascending: true });

  if (schoolIds) {
    query = query.in("school_id", schoolIds);
  }

  const { data: groups, error } = await query;
  if (error) throw new Error(error.message);

  const rows = groups ?? [];
  let namesIgnored = 0;
  const schoolsUpdated = new Set<string>();

  for (const row of rows) {
    const schoolId = row.school_id as string | null;
    const instructorName = (row.instructor_name as string | null)?.trim();
    if (!schoolId || !instructorName) continue;

    const result = await assignPreEtsPrimaryInstructorFromWorksheet(admin, {
      schoolId,
      programGroupId: row.id as string,
      instructorName,
    });

    if (result.matched && result.userId) {
      schoolsUpdated.add(schoolId);
    } else {
      namesIgnored++;
    }
  }

  return {
    processed: rows.length,
    schoolsUpdated: schoolsUpdated.size,
    namesIgnored,
  };
}

/** @deprecated Use syncPreEtsSchoolAssignmentsFromSpreadsheet */
export async function syncPreEtsInstructorsFromProgramGroups(
  admin: SupabaseClient,
  input?: { serviceMonth?: string }
): Promise<{
  processed: number;
  matched: number;
  unmatched: Array<{ schoolId: string; groupName: string; instructorName: string }>;
}> {
  const result = await syncPreEtsSchoolAssignmentsFromSpreadsheet(admin, {
    serviceMonth: input?.serviceMonth ?? "",
  });

  return {
    processed: result.processed,
    matched: result.schoolsUpdated,
    unmatched: [],
  };
}

/**
 * Apply one spreadsheet instructor name to a school when it resolves to a profile.
 * Returns whether an assignment was updated.
 */
export async function applySpreadsheetInstructorToSchoolIfMatched(
  admin: SupabaseClient,
  input: { schoolId: string; instructorName: string | null | undefined }
): Promise<boolean> {
  const raw = input.instructorName?.trim();
  if (!raw) return false;

  const { userId } = await resolvePreEtsStaffProfileByName(
    admin,
    raw,
    PRE_ETS_WORKSHEET_INSTRUCTOR_ROLES
  );
  if (!userId) return false;

  await replacePreEtsPrimaryInstructorForSchool(admin, {
    schoolId: input.schoolId,
    userId,
  });
  return true;
}
