import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";
import { preEtsServiceCodesMatch } from "./pre-ets-settings";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export type ProgramGroupRosterStudent = {
  participantId: string;
  fullName: string;
  listOrder: number;
};

export type ProgramGroupRosterMeta = {
  group_name: string;
  header_raw: string;
  service_code: string | null;
  service_label: string | null;
};

export type AuthRosterSummary = {
  id: string;
  auth_type: string;
  service_code: string | null;
  rosterCount: number;
};

/** Special events (Fair, Pre-9000, etc.) often bill one auth per student — not the school Main group auth. */
export function programGroupLooksLikeSpecialEvent(group: ProgramGroupRosterMeta): boolean {
  const blob = [
    group.group_name,
    group.header_raw,
    group.service_code ?? "",
    group.service_label ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return (
    /\bday at the fair\b|\bfair\b/.test(blob) ||
    /\bpre[-\s]?9000\b|\bpre[-\s]?5000\b|\bpre[-\s]?7000\b|\bpre[-\s]?7200\b/.test(blob) ||
    /\b9000\b|\b5000\b|\b7000\b|\b7200\b/.test(blob)
  );
}

/**
 * Choose which authorization(s) define the roster PDF for a program group.
 * Avoids pulling a shared "Main" group authorization onto event rosters when legacy
 * imports attached the wrong program_group_id.
 */
export function selectAuthorizationIdsForProgramGroupRoster(
  group: ProgramGroupRosterMeta,
  auths: AuthRosterSummary[]
): string[] {
  if (auths.length === 0) return [];

  const withStudents = auths.filter((a) => a.rosterCount > 0);
  if (withStudents.length === 0) return [];

  const isEvent = programGroupLooksLikeSpecialEvent(group);

  const groupStyle = withStudents.filter(
    (a) => (a.auth_type === "group" || a.auth_type === "pending") && a.rosterCount > 1
  );
  const singleSeat = withStudents.filter(
    (a) =>
      a.auth_type === "individual" ||
      ((a.auth_type === "pending" || a.auth_type === "group") && a.rosterCount === 1)
  );

  if (isEvent) {
    const eventCode = group.service_code?.trim() ?? "";
    let picked = singleSeat;
    if (eventCode) {
      const byCode = singleSeat.filter(
        (a) => a.service_code && preEtsServiceCodesMatch(a.service_code, eventCode)
      );
      if (byCode.length > 0) picked = byCode;
    }
    if (picked.length > 0) return picked.map((a) => a.id);
    return withStudents.map((a) => a.id);
  }

  if (groupStyle.length > 0) {
    const best = [...groupStyle].sort((a, b) => b.rosterCount - a.rosterCount)[0];
    if (best) return [best.id];
  }

  if (singleSeat.length > 0 && groupStyle.length === 0) {
    return singleSeat.map((a) => a.id);
  }

  const best = [...withStudents].sort((a, b) => b.rosterCount - a.rosterCount)[0];
  return best ? [best.id] : [];
}

async function loadProgramGroupMeta(
  admin: SupabaseClient,
  programGroupId: string
): Promise<ProgramGroupRosterMeta | null> {
  const { data } = await admin
    .from("pre_ets_program_groups")
    .select("group_name, header_raw, service_code, service_label")
    .eq("id", programGroupId)
    .maybeSingle();

  if (!data) return null;
  return {
    group_name: String(data.group_name ?? ""),
    header_raw: String(data.header_raw ?? ""),
    service_code: (data.service_code as string | null) ?? null,
    service_label: (data.service_label as string | null) ?? null,
  };
}

async function loadAuthSummariesForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<AuthRosterSummary[]> {
  const auths = await fetchAllPostgrestRows<{
    id: string;
    auth_type: string;
    service_code: string | null;
  }>(admin, "pre_ets_authorizations", "id, auth_type, service_code", {
    applyFilters: (q) => q.eq("program_group_id", programGroupId),
    order: { column: "created_at", ascending: true },
  });

  if (auths.length === 0) return [];

  const authIds = auths.map((a) => a.id);
  const entries = await fetchAllPostgrestRows<{
    authorization_id: string;
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null } | null;
  }>(admin, "pre_ets_roster_entries", "authorization_id, not_approved, pre_ets_students(participant_id)", {
    applyFilters: (q) => q.in("authorization_id", authIds),
  });

  const counts = new Map<string, number>();
  for (const row of entries) {
    if (row.not_approved) continue;
    const st = relationOne(row.pre_ets_students);
    if (!st?.participant_id?.trim()) continue;
    const authId = row.authorization_id;
    counts.set(authId, (counts.get(authId) ?? 0) + 1);
  }

  return auths.map((a) => ({
    id: a.id,
    auth_type: a.auth_type,
    service_code: a.service_code,
    rosterCount: counts.get(a.id) ?? 0,
  }));
}

/** Authorization ids that define the roster for this worksheet program group. */
export async function listAuthorizationIdsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<string[]> {
  const id = programGroupId.trim();
  if (!id) return [];

  const meta = await loadProgramGroupMeta(admin, id);
  const summaries = await loadAuthSummariesForProgramGroup(admin, id);
  if (!meta) {
    return summaries.filter((a) => a.rosterCount > 0).map((a) => a.id);
  }

  return selectAuthorizationIdsForProgramGroupRoster(meta, summaries);
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

/** Eligible roster students for a program group, deduped by PID. */
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
