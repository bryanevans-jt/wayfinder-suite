import type { SupabaseClient } from "@supabase/supabase-js";

export type DeletePreEtsSchoolResult = { ok: true } | { ok: false; error: string };

/** Removes a Pre-ETS school and cascaded program data (super-admin cleanup). */
export async function deletePreEtsSchool(
  admin: SupabaseClient,
  schoolId: string
): Promise<DeletePreEtsSchoolResult> {
  const trimmed = schoolId.trim();
  if (!trimmed) {
    return { ok: false, error: "School id is required" };
  }

  const { data: school, error: findErr } = await admin
    .from("pre_ets_schools")
    .select("id, name")
    .eq("id", trimmed)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: findErr.message };
  }
  if (!school) {
    return { ok: false, error: "School not found" };
  }

  const { error: deleteErr } = await admin.from("pre_ets_schools").delete().eq("id", trimmed);

  if (deleteErr) {
    return { ok: false, error: deleteErr.message };
  }

  return { ok: true };
}
