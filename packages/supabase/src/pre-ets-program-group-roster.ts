import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export type ProgramGroupRosterStudent = {
  participantId: string;
  fullName: string;
  listOrder: number;
};

/** All authorization ids billed under one worksheet program group (month + group header). */
export async function listAuthorizationIdsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<string[]> {
  const id = programGroupId.trim();
  if (!id) return [];

  const rows = await fetchAllPostgrestRows<{ id: string }>(admin, "pre_ets_authorizations", "id", {
    applyFilters: (q) => q.eq("program_group_id", id),
    order: { column: "created_at", ascending: true },
  });

  return rows.map((r) => r.id);
}

/** Resolve program group from an authorization when present. */
export async function programGroupIdForAuthorization(
  admin: SupabaseClient,
  authorizationId: string
): Promise<string | null> {
  const { data } = await admin
    .from("pre_ets_authorizations")
    .select("program_group_id")
    .eq("id", authorizationId)
    .maybeSingle();

  return (data?.program_group_id as string | null) ?? null;
}

/** Eligible roster students for a program group (all auths), deduped by PID. */
export async function loadEligibleRosterStudentsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<ProgramGroupRosterStudent[]> {
  const authIds = await listAuthorizationIdsForProgramGroup(admin, programGroupId);
  if (authIds.length === 0) return [];

  const entries = await fetchAllPostgrestRows<{
    list_order: number;
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null; full_name: string | null } | null;
  }>(admin, "pre_ets_roster_entries", "list_order, not_approved, pre_ets_students(participant_id, full_name)", {
    applyFilters: (q) => q.in("authorization_id", authIds),
    order: { column: "list_order", ascending: true },
  });

  const byPid = new Map<string, ProgramGroupRosterStudent>();
  for (const row of entries) {
    if (row.not_approved) continue;
    const st = relationOne(row.pre_ets_students);
    const pid = st?.participant_id?.trim() ?? "";
    if (!pid) continue;
    if (byPid.has(pid)) continue;
    byPid.set(pid, {
      participantId: pid,
      fullName: st?.full_name?.trim() ?? "",
      listOrder: row.list_order ?? 0,
    });
  }

  return [...byPid.values()].sort((a, b) => a.listOrder - b.listOrder || a.fullName.localeCompare(b.fullName));
}

export async function countEligibleRosterStudentsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<number> {
  const students = await loadEligibleRosterStudentsForProgramGroup(admin, programGroupId);
  return students.length;
}
