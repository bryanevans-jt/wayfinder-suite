import type { SupabaseClient } from "@supabase/supabase-js";

export type ProgramGroupVisibilityResult = { ok: true } | { ok: false; error: string };

export async function hidePreEtsProgramGroup(
  admin: SupabaseClient,
  programGroupId: string,
  actorUserId: string,
  reason?: string | null
): Promise<ProgramGroupVisibilityResult> {
  const id = programGroupId.trim();
  if (!id) return { ok: false, error: "Program group id is required" };

  const { data: row, error: findErr } = await admin
    .from("pre_ets_program_groups")
    .select("id, hidden_at")
    .eq("id", id)
    .maybeSingle();

  if (findErr) return { ok: false, error: findErr.message };
  if (!row) return { ok: false, error: "Program group not found" };
  if (row.hidden_at) return { ok: true };

  const { error } = await admin
    .from("pre_ets_program_groups")
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: actorUserId,
      hidden_reason: reason?.trim() || null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function restorePreEtsProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<ProgramGroupVisibilityResult> {
  const id = programGroupId.trim();
  if (!id) return { ok: false, error: "Program group id is required" };

  const { error } = await admin
    .from("pre_ets_program_groups")
    .update({
      hidden_at: null,
      hidden_by: null,
      hidden_reason: null,
      merged_into_program_group_id: null,
    })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Re-show a group when a worksheet import commits roster activity for it. */
export async function restorePreEtsProgramGroupFromWorksheetImport(
  admin: SupabaseClient,
  programGroupId: string
): Promise<void> {
  await admin
    .from("pre_ets_program_groups")
    .update({
      hidden_at: null,
      hidden_by: null,
      hidden_reason: null,
      merged_into_program_group_id: null,
    })
    .eq("id", programGroupId)
    .not("hidden_at", "is", null);
}

export async function mergePreEtsProgramGroups(
  admin: SupabaseClient,
  input: {
    sourceProgramGroupId: string;
    targetProgramGroupId: string;
    actorUserId: string;
    reason?: string | null;
  }
): Promise<ProgramGroupVisibilityResult> {
  const sourceId = input.sourceProgramGroupId.trim();
  const targetId = input.targetProgramGroupId.trim();
  if (!sourceId || !targetId) {
    return { ok: false, error: "Source and target program groups are required" };
  }
  if (sourceId === targetId) {
    return { ok: false, error: "Choose a different group to combine into" };
  }

  const { data: groups, error: loadErr } = await admin
    .from("pre_ets_program_groups")
    .select("id, school_id, service_month, hidden_at")
    .in("id", [sourceId, targetId]);

  if (loadErr) return { ok: false, error: loadErr.message };

  const source = groups?.find((g) => g.id === sourceId);
  const target = groups?.find((g) => g.id === targetId);
  if (!source || !target) {
    return { ok: false, error: "One or both program groups were not found" };
  }
  if (source.school_id !== target.school_id || source.service_month !== target.service_month) {
    return {
      ok: false,
      error: "Groups must belong to the same school and service month to combine",
    };
  }
  if (target.hidden_at) {
    return { ok: false, error: "Cannot combine into a hidden group — restore it first" };
  }

  const { error: authErr } = await admin
    .from("pre_ets_authorizations")
    .update({ program_group_id: targetId })
    .eq("program_group_id", sourceId);

  if (authErr) return { ok: false, error: authErr.message };

  await admin
    .from("pre_ets_sessions")
    .update({ program_group_id: targetId })
    .eq("program_group_id", sourceId);

  const { error: hideErr } = await admin
    .from("pre_ets_program_groups")
    .update({
      hidden_at: new Date().toISOString(),
      hidden_by: input.actorUserId,
      hidden_reason: input.reason?.trim() || "Combined into another group",
      merged_into_program_group_id: targetId,
    })
    .eq("id", sourceId);

  if (hideErr) return { ok: false, error: hideErr.message };
  return { ok: true };
}
