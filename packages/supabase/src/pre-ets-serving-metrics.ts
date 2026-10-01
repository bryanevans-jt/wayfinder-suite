import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";

export type PreEtsServingMetricsMonth = {
  /** Billing month (YYYY-MM). */
  serviceMonth: string;
  programGroupCount: number;
  uniqueStudentCount: number;
  uniqueSchoolCount: number;
  /** Latest worksheet commit for this billing month, if any. */
  lastWorksheetCommittedAt: string | null;
};

export type PreEtsServingMetricsSnapshot = {
  schoolYear: string | null;
  /** Metrics for the requested focus month (or latest month with data). */
  current: PreEtsServingMetricsMonth | null;
  /** All billing months with roster activity, oldest first. */
  history: PreEtsServingMetricsMonth[];
};

type RosterMetricsRow = {
  authorization_id: string;
  not_approved: boolean;
  pre_ets_authorizations: {
    service_month: string;
    program_group_id: string | null;
    school_id: string;
    pre_ets_program_groups: {
      id: string;
      hidden_at: string | null;
      merged_into_program_group_id: string | null;
    } | null;
    pre_ets_schools: {
      pre_ets_districts: { school_year: string } | { school_year: string }[] | null;
    } | null;
  } | null;
  pre_ets_students: {
    participant_id: string | null;
  } | null;
};

type AuthWithRosterRow = {
  id: string;
  service_month: string;
  program_group_id: string | null;
  school_id: string;
  pre_ets_program_groups: {
    id: string;
    hidden_at: string | null;
    merged_into_program_group_id: string | null;
  } | null;
  pre_ets_schools: {
    pre_ets_districts: { school_year: string } | { school_year: string }[] | null;
  } | null;
  pre_ets_roster_entries: Array<{
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null } | null;
  }>;
};

type WorksheetCommitRow = {
  service_month: string;
  committed_at: string | null;
};

const AUTH_METRICS_SELECT = [
  "id, service_month, program_group_id, school_id,",
  "pre_ets_program_groups(id, hidden_at, merged_into_program_group_id),",
  "pre_ets_schools(pre_ets_districts(school_year)),",
  "pre_ets_roster_entries(not_approved, pre_ets_students(participant_id))",
].join(" ");

function normalizeServiceMonthDate(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

/** True when the spreadsheet PID is present and usable for billing metrics. */
export function preEtsParticipantIdEligibleForMetrics(participantId: string | null | undefined): boolean {
  const pid = (participantId ?? "").trim();
  if (!pid) return false;
  if (/^not\s*approved$/i.test(pid)) return false;
  return true;
}

export function normalizePreEtsServiceMonthKey(raw: string): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 7);
  return trimmed.slice(0, 7);
}

function schoolYearForAuth(auth: NonNullable<RosterMetricsRow["pre_ets_authorizations"]>): string | null {
  const districts = auth.pre_ets_schools?.pre_ets_districts ?? null;
  if (!districts) return null;
  if (Array.isArray(districts)) {
    return districts[0]?.school_year ?? null;
  }
  return districts.school_year ?? null;
}

function programGroupEligible(
  group: {
    hidden_at: string | null;
    merged_into_program_group_id: string | null;
  } | null
): boolean {
  if (!group) return true;
  if (group.hidden_at) return false;
  if (group.merged_into_program_group_id) return false;
  return true;
}

function rosterRowsFromAuthorizations(auths: AuthWithRosterRow[]): RosterMetricsRow[] {
  const rows: RosterMetricsRow[] = [];
  for (const auth of auths) {
    const authPayload = {
      service_month: auth.service_month,
      program_group_id: auth.program_group_id,
      school_id: auth.school_id,
      pre_ets_program_groups: auth.pre_ets_program_groups,
      pre_ets_schools: auth.pre_ets_schools,
    };
    for (const entry of auth.pre_ets_roster_entries ?? []) {
      rows.push({
        authorization_id: auth.id,
        not_approved: entry.not_approved,
        pre_ets_authorizations: authPayload,
        pre_ets_students: entry.pre_ets_students,
      });
    }
  }
  return rows;
}

async function loadAuthorizationMetricsRows(
  admin: SupabaseClient,
  options?: { districtId?: string; serviceMonth?: string }
): Promise<RosterMetricsRow[]> {
  let schoolIds: string[] | null = null;
  if (options?.districtId?.trim()) {
    const { data: schools, error } = await admin
      .from("pre_ets_schools")
      .select("id")
      .eq("district_id", options.districtId.trim());
    if (error) throw new Error(error.message);
    schoolIds = (schools ?? []).map((s) => s.id as string);
    if (schoolIds.length === 0) return [];
  }

  const serviceMonth = options?.serviceMonth?.trim()
    ? normalizeServiceMonthDate(options.serviceMonth)
    : null;

  const auths = await fetchAllPostgrestRows<AuthWithRosterRow>(
    admin,
    "pre_ets_authorizations",
    AUTH_METRICS_SELECT,
    {
      pageSize: 250,
      applyFilters: (q) => {
        let query = q;
        if (serviceMonth) query = query.eq("service_month", serviceMonth);
        if (schoolIds) query = query.in("school_id", schoolIds);
        return query;
      },
    }
  );

  return rosterRowsFromAuthorizations(auths);
}

/** Aggregate eligible roster rows into per-month group and unique PID counts. */
export function aggregatePreEtsServingMetricsFromRosterRows(
  rows: RosterMetricsRow[],
  options?: { schoolYear?: string | null }
): Map<string, { programGroups: Set<string>; students: Set<string>; schools: Set<string> }> {
  const schoolYearFilter = options?.schoolYear?.trim() || null;
  const byMonth = new Map<
    string,
    { programGroups: Set<string>; students: Set<string>; schools: Set<string> }
  >();

  for (const row of rows) {
    if (row.not_approved) continue;
    const auth = row.pre_ets_authorizations;
    if (!auth?.service_month) continue;

    const year = schoolYearForAuth(auth);
    if (schoolYearFilter && year && year !== schoolYearFilter) continue;

    if (!programGroupEligible(auth.pre_ets_program_groups)) continue;

    const pid = row.pre_ets_students?.participant_id ?? "";
    if (!preEtsParticipantIdEligibleForMetrics(pid)) continue;

    const monthKey = normalizePreEtsServiceMonthKey(auth.service_month);
    let bucket = byMonth.get(monthKey);
    if (!bucket) {
      bucket = { programGroups: new Set(), students: new Set(), schools: new Set() };
      byMonth.set(monthKey, bucket);
    }

    bucket.students.add(pid.trim());
    bucket.schools.add(auth.school_id);
    const groupId = auth.program_group_id;
    if (groupId) bucket.programGroups.add(groupId);
  }

  return byMonth;
}

function monthRowsToHistory(
  byMonth: Map<string, { programGroups: Set<string>; students: Set<string>; schools: Set<string> }>,
  lastCommitByMonth: Map<string, string>
): PreEtsServingMetricsMonth[] {
  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([serviceMonth, bucket]) => ({
      serviceMonth,
      programGroupCount: bucket.programGroups.size,
      uniqueStudentCount: bucket.students.size,
      uniqueSchoolCount: bucket.schools.size,
      lastWorksheetCommittedAt: lastCommitByMonth.get(serviceMonth) ?? null,
    }));
}

function emptyMetricsMonth(serviceMonth: string): PreEtsServingMetricsMonth {
  return {
    serviceMonth: normalizePreEtsServiceMonthKey(serviceMonth),
    programGroupCount: 0,
    uniqueStudentCount: 0,
    uniqueSchoolCount: 0,
    lastWorksheetCommittedAt: null,
  };
}

/** Fast path after worksheet commit / re-parse — one district and billing month only. */
export async function loadPreEtsDistrictServingMetrics(
  admin: SupabaseClient,
  input: { districtId: string; serviceMonth: string }
): Promise<PreEtsServingMetricsMonth> {
  const rows = await loadAuthorizationMetricsRows(admin, {
    districtId: input.districtId,
    serviceMonth: input.serviceMonth,
  });
  const monthKey = normalizePreEtsServiceMonthKey(input.serviceMonth);
  const bucket = aggregatePreEtsServingMetricsFromRosterRows(rows).get(monthKey);
  if (!bucket) return emptyMetricsMonth(monthKey);
  return {
    serviceMonth: monthKey,
    programGroupCount: bucket.programGroups.size,
    uniqueStudentCount: bucket.students.size,
    uniqueSchoolCount: bucket.schools.size,
    lastWorksheetCommittedAt: null,
  };
}

export async function loadPreEtsServingMetrics(
  admin: SupabaseClient,
  options?: { schoolYear?: string | null; focusMonth?: string | null }
): Promise<PreEtsServingMetricsSnapshot> {
  const schoolYear = options?.schoolYear?.trim() || null;
  const focusMonthRaw = options?.focusMonth?.trim();
  const focusMonth = focusMonthRaw ? normalizePreEtsServiceMonthKey(focusMonthRaw) : null;

  const rosterRows = await loadAuthorizationMetricsRows(admin);

  const commits = await fetchAllPostgrestRows<WorksheetCommitRow>(
    admin,
    "pre_ets_worksheet_imports",
    "service_month, committed_at",
    {
      applyFilters: (q) => q.eq("status", "committed").not("committed_at", "is", null),
      order: { column: "committed_at", ascending: false },
    }
  );

  const lastCommitByMonth = new Map<string, string>();
  for (const row of commits) {
    const key = normalizePreEtsServiceMonthKey(String(row.service_month));
    if (!lastCommitByMonth.has(key) && row.committed_at) {
      lastCommitByMonth.set(key, row.committed_at);
    }
  }

  const byMonth = aggregatePreEtsServingMetricsFromRosterRows(rosterRows, { schoolYear });
  const history = monthRowsToHistory(byMonth, lastCommitByMonth);

  let current: PreEtsServingMetricsMonth | null = null;
  if (focusMonth) {
    current = history.find((h) => h.serviceMonth === focusMonth) ?? null;
  }
  if (!current && history.length > 0) {
    current = history[history.length - 1] ?? null;
  }

  return { schoolYear, current, history };
}
