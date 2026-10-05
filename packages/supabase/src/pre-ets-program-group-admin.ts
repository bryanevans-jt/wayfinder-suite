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

export type RemoveEmptyProgramGroupResult =
  | { ok: true; mode: "hidden" | "deleted" }
  | { ok: false; error: string };

/**
 * Remove a setup-only program group shell (no students). Refuses groups with roster
 * students or entered authorization numbers so live rosters cannot be removed by mistake.
 */
export async function removeEmptyPreEtsProgramGroupShell(
  admin: SupabaseClient,
  programGroupId: string,
  actorUserId: string
): Promise<RemoveEmptyProgramGroupResult> {
  const id = programGroupId.trim();
  if (!id) return { ok: false, error: "Program group id is required" };

  const { data: group, error: findErr } = await admin
    .from("pre_ets_program_groups")
    .select("id, group_name, hidden_at")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };
  if (!group) return { ok: false, error: "Program group not found" };

  const { data: auths, error: authLoadErr } = await admin
    .from("pre_ets_authorizations")
    .select("id, auth_number")
    .eq("program_group_id", id);

  if (authLoadErr) return { ok: false, error: authLoadErr.message };

  const authIds = (auths ?? []).map((a) => a.id as string);
  if ((auths ?? []).some((a) => (a.auth_number as string | null)?.trim())) {
    return {
      ok: false,
      error:
        "This group has an authorization number on file. Use Hide group instead of removing the shell.",
    };
  }

  if (authIds.length > 0) {
    const { count, error: rosterErr } = await admin
      .from("pre_ets_roster_entries")
      .select("id", { count: "exact", head: true })
      .in("authorization_id", authIds)
      .eq("not_approved", false);

    if (rosterErr) return { ok: false, error: rosterErr.message };
    if ((count ?? 0) > 0) {
      return {
        ok: false,
        error: `This group still has ${count} roster student(s). Only empty shells can be removed.`,
      };
    }
  }

  if (group.hidden_at) {
    const deleted = await deletePreEtsProgramGroup(admin, id);
    if (!deleted.ok) return deleted;
    return { ok: true, mode: "deleted" };
  }

  const { hidePreEtsProgramGroup } = await import("./pre-ets-program-group-visibility");
  const hidden = await hidePreEtsProgramGroup(admin, id, actorUserId, "Empty group shell removed from pipeline");
  if (!hidden.ok) return hidden;
  return { ok: true, mode: "hidden" };
}
