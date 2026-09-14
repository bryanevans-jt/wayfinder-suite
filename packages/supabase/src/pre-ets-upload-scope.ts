import type { SupabaseClient } from "@supabase/supabase-js";
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
export function worksheetUploadBypassesDistrictScope(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return isSuperAdminRole(r) || isAccountantRole(r);
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
  if (isSuperAdminRole(r) || isAccountantRole(r)) {
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
  if (isAdminRole(r)) {
    const { data } = await admin
      .from("pre_ets_staff_school_assignments")
      .select("school_id")
      .eq("user_id", userId);
    return [...new Set((data ?? []).map((row) => row.school_id as string))];
  }
  return [];
}

export async function assertPlanningWorksheetDistrictAllowed(
  admin: SupabaseClient,
  userId: string,
  role: string | null | undefined,
  districtNumber: string,
  schoolYear: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (worksheetUploadBypassesDistrictScope(role)) {
    return { ok: true };
  }

  const r = normalizeRole(role);
  const districts = isAdminRole(r)
    ? await loadAdminPreEtsDistricts(admin, userId)
    : isSupervisorRole(r)
      ? await loadSupervisorPreEtsDistricts(admin, userId)
      : [];

  if (!isAdminRole(r) && !isSupervisorRole(r)) {
    return { ok: false, error: "You do not have permission to upload planning worksheets." };
  }

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

/** Planning upload + auto-commit (supervisor or regional admin). */
export function usesPreEtsPlanningWorksheetUpload(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  if (isAccountantRole(r) && !isAdminRole(r) && !isSupervisorRole(r)) {
    return false;
  }
  return isSupervisorRole(r) || isAdminRole(r) || isSuperAdminRole(r);
}
