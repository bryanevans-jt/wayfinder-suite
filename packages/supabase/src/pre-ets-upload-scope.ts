import type { SupabaseClient } from "@supabase/supabase-js";
import {
  preEtsWorksheetTestingOverrideActive,
  type PreEtsSettingsRow,
} from "./pre-ets-settings";
import {
  isAccountantRole,
  isAdminRole,
  isSuperAdminRole,
  isSupervisorRole,
  normalizeRole,
} from "./roles";

export type PreEtsUploadDistrict = {
  districtId: string;
  gvraDistrictNumber: string;
  schoolYear: string | null;
};

/** Super Admin and Accounts Specialist may upload any district (support). */
export function worksheetUploadBypassesDistrictScope(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "worksheet_testing_override_enabled">
): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r) || isAccountantRole(r)) return true;
  return (
    preEtsWorksheetTestingOverrideActive(
      settings ?? { worksheet_testing_override_enabled: false }
    ) && isAdminRole(r)
  );
}

/**
 * May upload district CSV / workbook.
 * Admin, Accounts Specialist, and Super Admin only — Regional Supervisors cannot.
 */
export function canUploadPreEtsWorksheets(
  role: string | null | undefined,
  settings?: Pick<PreEtsSettingsRow, "worksheet_testing_override_enabled">
): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r) || isAccountantRole(r) || isAdminRole(r)) return true;
  void settings;
  return false;
}

async function loadDistrictsForSchoolIds(
  admin: SupabaseClient,
  schoolIds: string[]
): Promise<PreEtsUploadDistrict[]> {
  if (schoolIds.length === 0) return [];

  const { data: schools, error: schoolErr } = await admin
    .from("pre_ets_schools")
    .select("district_id, pre_ets_districts(id, gvra_district_number, school_year)")
    .in("id", schoolIds);

  if (schoolErr) {
    throw new Error(schoolErr.message);
  }

  const byId = new Map<string, PreEtsUploadDistrict>();
  for (const row of schools ?? []) {
    const districtRaw = row.pre_ets_districts as
      | { id: string; gvra_district_number: string; school_year: string }
      | { id: string; gvra_district_number: string; school_year: string }[]
      | null;
    const district = Array.isArray(districtRaw) ? districtRaw[0] : districtRaw;
    if (!district?.id) continue;
    byId.set(district.id, {
      districtId: district.id,
      gvraDistrictNumber: district.gvra_district_number,
      schoolYear: district.school_year ?? null,
    });
  }

  return [...byId.values()];
}

export async function loadSupervisorPreEtsDistricts(
  admin: SupabaseClient,
  userId: string
): Promise<PreEtsUploadDistrict[]> {
  const { data: assignments, error } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("school_id")
    .eq("user_id", userId)
    .eq("assignment_role", "supervisor");

  if (error) throw new Error(error.message);

  const schoolIds = [...new Set((assignments ?? []).map((r) => r.school_id as string))];
  return loadDistrictsForSchoolIds(admin, schoolIds);
}

/** Admin Pre-ETS uploads: any staff assignment on the school (primary, co, supervisor). */
export async function loadAdminPreEtsDistricts(
  admin: SupabaseClient,
  userId: string
): Promise<PreEtsUploadDistrict[]> {
  const { data: assignments, error } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("school_id")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const schoolIds = [...new Set((assignments ?? []).map((r) => r.school_id as string))];
  return loadDistrictsForSchoolIds(admin, schoolIds);
}

export async function loadPreEtsAssignedSchoolIds(
  admin: SupabaseClient,
  userId: string,
  role: string | null | undefined
): Promise<string[] | null> {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r) || isAccountantRole(r) || isAdminRole(r)) {
    return null;
  }
  if (isSupervisorRole(r)) {
    const { data } = await admin
      .from("pre_ets_staff_school_assignments")
      .select("school_id")
      .eq("user_id", userId)
      .eq("assignment_role", "supervisor");
    return [...new Set((data ?? []).map((row) => row.school_id as string))];
  }
  return [];
}

export async function assertPlanningWorksheetDistrictAllowed(
  admin: SupabaseClient,
  userId: string,
  role: string | null | undefined,
  districtNumber: string,
  schoolYear: string,
  settings?: Pick<PreEtsSettingsRow, "worksheet_testing_override_enabled">
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (worksheetUploadBypassesDistrictScope(role, settings)) {
    return { ok: true };
  }

  const r = normalizeRole(role);
  if (!isAdminRole(r)) {
    return { ok: false, error: "You do not have permission to upload planning worksheets." };
  }

  const districts = await loadAdminPreEtsDistricts(admin, userId);

  if (districts.length === 0) {
    return {
      ok: false,
      error:
        "You are not assigned on any Pre-ETS school. Ask an admin to add you under Pre-ETS Assignments.",
    };
  }

  const normalized = districtNumber.trim();
  const allowed = districts.some(
    (d) =>
      d.gvraDistrictNumber.trim() === normalized &&
      (!d.schoolYear || d.schoolYear === schoolYear)
  );

  if (!allowed) {
    return {
      ok: false,
      error: `District ${normalized} is not in your Pre-ETS school assignments for school year ${schoolYear}.`,
    };
  }

  return { ok: true };
}

/** Planning upload + auto-commit (Super Admin or Admin). Accounts Specialist uses auth_match. */
export function usesPreEtsPlanningWorksheetUpload(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isSuperAdminRole(r) || isAdminRole(r)) return true;
  return false;
}
