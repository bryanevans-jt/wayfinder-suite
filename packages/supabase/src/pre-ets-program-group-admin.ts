import type { SupabaseClient } from "@supabase/supabase-js";

export type DeletePreEtsProgramGroupResult = { ok: true } | { ok: false; error: string };

/** Removes one program group and its authorizations (rosters, sessions cascade). School record stays. */
export async function deletePreEtsProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<DeletePreEtsProgramGroupResult> {
  const trimmed = programGroupId.trim();
  if (!trimmed) {
    return { ok: false, error: "Program group id is required" };
  }

  const { data: group, error: findErr } = await admin
    .from("pre_ets_program_groups")
    .select("id, group_name, school_id, pre_ets_schools(name)")
    .eq("id", trimmed)
    .maybeSingle();

  if (findErr) {
    return { ok: false, error: findErr.message };
  }
  if (!group) {
    return { ok: false, error: "Program group not found" };
  }

  const { error: authErr } = await admin
    .from("pre_ets_authorizations")
    .delete()
    .eq("program_group_id", trimmed);

  if (authErr) {
    return { ok: false, error: authErr.message };
  }

  const { error: deleteErr } = await admin.from("pre_ets_program_groups").delete().eq("id", trimmed);

  if (deleteErr) {
    return { ok: false, error: deleteErr.message };
  }

  return { ok: true };
}
