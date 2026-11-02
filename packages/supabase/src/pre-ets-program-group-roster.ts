import type { SupabaseClient } from "@supabase/supabase-js";
import { isPreEtsPendingParticipantId } from "./pre-ets-pending-participant-id";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";
import {
  loadWorksheetParticipantAllowlistForProgramGroup,
  loadWorksheetParticipantAllowlistsForProgramGroups,
} from "./pre-ets-program-group-worksheet-roster";
import { worksheetHeaderKeysMatch } from "./pre-ets-worksheet-parser";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export type ProgramGroupRosterStudent = {
  participantId: string;
  fullName: string;
  listOrder: number;
};

/** GVRA billing / PDF export requires a real PID, not a worksheet placeholder. */
export function isBillableRosterParticipantId(participantId: string | null | undefined): boolean {
  const pid = (participantId ?? "").trim();
  return pid.length > 0 && !isPreEtsPendingParticipantId(pid);
}

type ProgramGroupHeaderMeta = {
  worksheet_header_key: string | null;
  header_raw: string;
};

/** Only authorizations imported under the same spreadsheet header as this program group. */
export function authorizationMatchesProgramGroupHeader(
  programGroup: ProgramGroupHeaderMeta,
  authHeaderKey: string | null | undefined
): boolean {
  const pgKey = programGroup.worksheet_header_key?.trim() ?? "";
  const pgRaw = programGroup.header_raw?.trim() ?? "";
  if (!pgKey && !pgRaw) return true;

  const authKey = authHeaderKey?.trim() ?? "";
  if (!authKey) return false;

  if (pgKey && worksheetHeaderKeysMatch(pgKey, authKey)) return true;
  if (pgRaw && worksheetHeaderKeysMatch(pgRaw, authKey)) return true;
  return false;
}

async function loadProgramGroupHeaderMeta(
  admin: SupabaseClient,
  programGroupId: string
): Promise<ProgramGroupHeaderMeta | null> {
  const { data } = await admin
    .from("pre_ets_program_groups")
    .select("worksheet_header_key, header_raw")
    .eq("id", programGroupId)
    .maybeSingle();

  if (!data) return null;
  return {
    worksheet_header_key: (data.worksheet_header_key as string | null) ?? null,
    header_raw: String(data.header_raw ?? ""),
  };
}

/** Authorization ids billed under one worksheet program group (exact header line only). */
export async function listAuthorizationIdsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<string[]> {
  const id = programGroupId.trim();
  if (!id) return [];

  const meta = await loadProgramGroupHeaderMeta(admin, id);
  const auths = await fetchAllPostgrestRows<{
    id: string;
    worksheet_header_key: string | null;
  }>(admin, "pre_ets_authorizations", "id, worksheet_header_key", {
    applyFilters: (q) => q.eq("program_group_id", id),
    order: { column: "created_at", ascending: true },
  });

  if (!meta) {
    return auths.map((a) => a.id);
  }

  const hasHeader = Boolean(meta.worksheet_header_key?.trim() || meta.header_raw.trim());
  if (!hasHeader) {
    return auths.map((a) => a.id);
  }

  return auths
    .filter((a) => authorizationMatchesProgramGroupHeader(meta, a.worksheet_header_key))
    .map((a) => a.id);
}

export type ProgramGroupRosterCounts = {
  authorizationIdsByProgramGroup: Map<string, string[]>;
  authorizationTypeById: Map<string, string>;
  eligibleStudentCountByAuthorization: Map<string, number>;
  eligibleStudentCountByProgramGroup: Map<string, number>;
};

/**
 * Batch equivalent of the program-group and authorization count helpers.
 * It avoids per-group metadata, authorization, roster, settings, and worksheet reads.
 */
export async function loadProgramGroupRosterCounts(
  admin: SupabaseClient,
  programGroupIds: string[]
): Promise<ProgramGroupRosterCounts> {
  const ids = [...new Set(programGroupIds.map((id) => id.trim()).filter(Boolean))];
  const authorizationIdsByProgramGroup = new Map<string, string[]>(
    ids.map((id) => [id, []])
  );
  const authorizationTypeById = new Map<string, string>();
  const eligibleStudentCountByAuthorization = new Map<string, number>();
  const eligibleStudentCountByProgramGroup = new Map<string, number>(
    ids.map((id) => [id, 0])
  );
  if (ids.length === 0) {
    return {
      authorizationIdsByProgramGroup,
      authorizationTypeById,
      eligibleStudentCountByAuthorization,
      eligibleStudentCountByProgramGroup,
    };
  }

  const [groups, auths] = await Promise.all([
    fetchAllPostgrestRows<{
      id: string;
      worksheet_header_key: string | null;
      header_raw: string | null;
    }>(
      admin,
      "pre_ets_program_groups",
      "id, worksheet_header_key, header_raw",
      { applyFilters: (query) => query.in("id", ids) }
    ),
    fetchAllPostgrestRows<{
      id: string;
      program_group_id: string;
      auth_type: string;
      worksheet_header_key: string | null;
    }>(
      admin,
      "pre_ets_authorizations",
      "id, program_group_id, auth_type, worksheet_header_key",
      {
        applyFilters: (query) => query.in("program_group_id", ids),
        order: { column: "created_at", ascending: true },
      }
    ),
  ]);
  const groupById = new Map(groups.map((group) => [group.id, group]));
  const programGroupIdByAuthorization = new Map<string, string>();

  for (const auth of auths) {
    const group = groupById.get(auth.program_group_id);
    if (
      group &&
      !authorizationMatchesProgramGroupHeader(
        {
          worksheet_header_key: group.worksheet_header_key,
          header_raw: group.header_raw ?? "",
        },
        auth.worksheet_header_key
      )
    ) {
      continue;
    }
    const current = authorizationIdsByProgramGroup.get(auth.program_group_id) ?? [];
    current.push(auth.id);
    authorizationIdsByProgramGroup.set(auth.program_group_id, current);
    authorizationTypeById.set(auth.id, auth.auth_type);
    programGroupIdByAuthorization.set(auth.id, auth.program_group_id);
  }

  const authIds = [...programGroupIdByAuthorization.keys()];
  if (authIds.length === 0) {
    return {
      authorizationIdsByProgramGroup,
      authorizationTypeById,
      eligibleStudentCountByAuthorization,
      eligibleStudentCountByProgramGroup,
    };
  }

  const [entries, allowlists] = await Promise.all([
    fetchAllPostgrestRows<{
      authorization_id: string;
      not_approved: boolean;
      pre_ets_students: {
        participant_id: string | null;
        full_name: string | null;
      } | null;
    }>(
      admin,
      "pre_ets_roster_entries",
      "authorization_id, not_approved, pre_ets_students(participant_id, full_name)",
      {
        applyFilters: (query) =>
          query.in("authorization_id", authIds).eq("not_approved", false),
      }
    ),
    loadWorksheetParticipantAllowlistsForProgramGroups(admin, ids),
  ]);

  const participantIdsByProgramGroup = new Map<string, Set<string>>();
  for (const entry of entries) {
    if (entry.not_approved) continue;
    const student = relationOne(entry.pre_ets_students);
    const participantId = student?.participant_id?.trim() ?? "";
    if (!isBillableRosterParticipantId(participantId)) continue;
    eligibleStudentCountByAuthorization.set(
      entry.authorization_id,
      (eligibleStudentCountByAuthorization.get(entry.authorization_id) ?? 0) + 1
    );
    const programGroupId = programGroupIdByAuthorization.get(entry.authorization_id);
    if (!programGroupId) continue;
    const participantIds =
      participantIdsByProgramGroup.get(programGroupId) ?? new Set<string>();
    participantIds.add(participantId);
    participantIdsByProgramGroup.set(programGroupId, participantIds);
  }

  for (const programGroupId of ids) {
    const participantIds =
      participantIdsByProgramGroup.get(programGroupId) ?? new Set<string>();
    const allowlist = allowlists.get(programGroupId);
    const count =
      allowlist && allowlist.size > 0
        ? [...participantIds].filter((participantId) =>
            allowlist.has(participantId)
          ).length
        : participantIds.size;
    eligibleStudentCountByProgramGroup.set(programGroupId, count);
  }

  return {
    authorizationIdsByProgramGroup,
    authorizationTypeById,
    eligibleStudentCountByAuthorization,
    eligibleStudentCountByProgramGroup,
  };
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

/** Eligible roster students for a program group (header-scoped auths only), deduped by PID. */
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
    if (!isBillableRosterParticipantId(pid)) continue;
    if (byPid.has(pid)) continue;
    byPid.set(pid, {
      participantId: pid,
      fullName: st?.full_name?.trim() ?? "",
      listOrder: row.list_order ?? 0,
    });
  }

  let students = [...byPid.values()].sort(
    (a, b) => a.listOrder - b.listOrder || a.fullName.localeCompare(b.fullName)
  );

  const allowlist = await loadWorksheetParticipantAllowlistForProgramGroup(admin, programGroupId);
  if (allowlist && allowlist.size > 0) {
    students = students.filter((s) => allowlist.has(s.participantId));
  }

  return students;
}

/** Roster students saved on one authorization (respects Edit roster / finalize). */
export async function loadEligibleRosterStudentsForAuthorization(
  admin: SupabaseClient,
  authorizationId: string
): Promise<ProgramGroupRosterStudent[]> {
  const id = authorizationId.trim();
  if (!id) return [];

  const entries = await fetchAllPostgrestRows<{
    list_order: number;
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null; full_name: string | null } | null;
  }>(admin, "pre_ets_roster_entries", "list_order, not_approved, pre_ets_students(participant_id, full_name)", {
    applyFilters: (q) => q.eq("authorization_id", id),
    order: { column: "list_order", ascending: true },
  });

  const students: ProgramGroupRosterStudent[] = [];
  for (const row of entries) {
    if (row.not_approved) continue;
    const st = relationOne(row.pre_ets_students);
    const pid = st?.participant_id?.trim() ?? "";
    if (!isBillableRosterParticipantId(pid)) continue;
    students.push({
      participantId: pid,
      fullName: st?.full_name?.trim() ?? "",
      listOrder: row.list_order ?? 0,
    });
  }

  return students.sort(
    (a, b) => a.listOrder - b.listOrder || a.fullName.localeCompare(b.fullName)
  );
}

/** Roster rows on an authorization, including placeholder PIDs awaiting entry. */
export async function countRosterStudentsForAuthorization(
  admin: SupabaseClient,
  authorizationId: string
): Promise<number> {
  const { count, error } = await admin
    .from("pre_ets_roster_entries")
    .select("id", { count: "exact", head: true })
    .eq("authorization_id", authorizationId)
    .eq("not_approved", false);

  if (error) return 0;
  return count ?? 0;
}

export async function countEligibleRosterStudentsForAuthorization(
  admin: SupabaseClient,
  authorizationId: string
): Promise<number> {
  const students = await loadEligibleRosterStudentsForAuthorization(admin, authorizationId);
  return students.length;
}

export async function loadEligibleRosterCountsForAuthorizations(
  admin: SupabaseClient,
  authorizationIds: string[]
): Promise<Map<string, number>> {
  const ids = [
    ...new Set(authorizationIds.map((id) => id.trim()).filter(Boolean)),
  ];
  const counts = new Map<string, number>(ids.map((id) => [id, 0]));
  if (ids.length === 0) return counts;

  const entries = await fetchAllPostgrestRows<{
    authorization_id: string;
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null } | null;
  }>(
    admin,
    "pre_ets_roster_entries",
    "authorization_id, not_approved, pre_ets_students(participant_id)",
    {
      applyFilters: (query) =>
        query.in("authorization_id", ids).eq("not_approved", false),
    }
  );
  for (const entry of entries) {
    if (entry.not_approved) continue;
    const student = relationOne(entry.pre_ets_students);
    if (!isBillableRosterParticipantId(student?.participant_id)) continue;
    counts.set(
      entry.authorization_id,
      (counts.get(entry.authorization_id) ?? 0) + 1
    );
  }
  return counts;
}

export async function countEligibleRosterStudentsForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<number> {
  const students = await loadEligibleRosterStudentsForProgramGroup(admin, programGroupId);
  return students.length;
}
