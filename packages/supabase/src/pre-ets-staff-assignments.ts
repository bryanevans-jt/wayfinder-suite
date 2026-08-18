import type { SupabaseClient } from "@supabase/supabase-js";
import { isInstructorRole, isEsRole, normalizeRole } from "./roles";

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
