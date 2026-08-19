import type { SupabaseClient } from "@supabase/supabase-js";
import { isInstructorRole, isEsRole, normalizeRole } from "./roles";

export type PreEtsSchoolInstructor = {
  userId: string;
  fullName: string | null;
};

/** School IDs an instructor/ES may access when assignments exist; null = unrestricted. */
export async function loadPreEtsAssignedSchoolIds(
  admin: SupabaseClient,
  userId: string,
  role: string | null | undefined
): Promise<string[] | null> {
  const r = normalizeRole(role);
  if (!isInstructorRole(r) && !isEsRole(r)) {
    return null;
  }

  const { data } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("school_id")
    .eq("user_id", userId);

  if (!data?.length) return null;
  return [...new Set(data.map((row) => row.school_id as string))];
}

export function schoolAllowed(
  schoolId: string | null | undefined,
  allowedSchoolIds: string[] | null
): boolean {
  if (!allowedSchoolIds || !schoolId) return true;
  return allowedSchoolIds.includes(schoolId);
}

const ASSIGNMENT_ROLE_PRIORITY = ["primary", "co_instructor", "supervisor"] as const;

/** Primary instructor for a school from staff assignments, or null if none. */
export async function resolvePrimaryInstructorForSchool(
  admin: SupabaseClient,
  schoolId: string
): Promise<PreEtsSchoolInstructor | null> {
  const { data } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("user_id, assignment_role, profiles(full_name)")
    .eq("school_id", schoolId);

  if (!data?.length) return null;

  const byRole = new Map(data.map((row) => [row.assignment_role as string, row]));
  for (const role of ASSIGNMENT_ROLE_PRIORITY) {
    const match = byRole.get(role);
    if (!match) continue;
    const profile = match.profiles as { full_name: string | null } | { full_name: string | null }[] | null;
    const fullName = Array.isArray(profile) ? profile[0]?.full_name ?? null : profile?.full_name ?? null;
    return { userId: match.user_id as string, fullName };
  }

  return null;
}

/** Co-instructor for a school from staff assignments, or null if none. */
export async function resolveCoInstructorForSchool(
  admin: SupabaseClient,
  schoolId: string
): Promise<PreEtsSchoolInstructor | null> {
  const { data } = await admin
    .from("pre_ets_staff_school_assignments")
    .select("user_id, profiles(full_name)")
    .eq("school_id", schoolId)
    .eq("assignment_role", "co_instructor")
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const profile = data.profiles as { full_name: string | null } | { full_name: string | null }[] | null;
  const fullName = Array.isArray(profile) ? profile[0]?.full_name ?? null : profile?.full_name ?? null;
  return { userId: data.user_id as string, fullName };
}
