import {
  minutesToDecimalHours,
  parseLocalDate,
  weekEndSaturday,
  weekStartSunday,
  displayServiceTimes,
  sumBillableMinutes,
  workedMinutesFromEntries,
  type ServiceActivityType,
} from "@wayfinder/supabase/es-time-tracking";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { clientDisplayName } from "@wayfinder/branding";
import { loadStaffNameById } from "@/lib/operations-data";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";

export type EsTimeEntryRow = {
  id: string;
  es_user_id: string;
  client_id: string | null;
  client_name: string | null;
  activity_type_id: string;
  activity_code: string;
  activity_name: string;
  activity_category: string;
  service_date: string;
  duration_minutes: number;
  duration_hours: string;
  service_start_at: string | null;
  service_end_at: string | null;
  created_at: string | null;
  narrative: string | null;
  linked_source_type: string | null;
  status: string;
  flags: Record<string, boolean>;
};

export type EsWeekSubmissionRow = {
  id: string;
  es_user_id: string;
  es_name: string;
  week_start: string;
  week_end: string;
  total_minutes: number;
  status: string;
  submitted_at: string | null;
  approved_at: string | null;
  supervisor_notes: string | null;
};

export async function loadEsTimeEntriesForWeek(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string,
  weekStart: string
): Promise<EsTimeEntryRow[]> {
  const weekEnd = weekEndSaturday(weekStart);

  const { data, error } = await admin
    .from("es_time_entries")
    .select(
      `
      id,
      es_user_id,
      client_id,
      activity_type_id,
      service_date,
      duration_minutes,
      service_start_at,
      service_end_at,
      created_at,
      narrative,
      linked_source_type,
      status,
      flags,
      service_activity_types ( code, name, category )
    `
    )
    .eq("es_user_id", esUserId)
    .gte("service_date", weekStart)
    .lte("service_date", weekEnd)
    .order("service_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const clientIds = [
    ...new Set(
      (data ?? [])
        .map((r) => r.client_id as string | null)
        .filter((id): id is string => typeof id === "string")
    ),
  ];

  const clientNameById = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data: clients } = await admin
      .from("clients")
      .select("id, contact_email, user_id, profile_id")
      .in("id", clientIds);

    const authIds = [
      ...new Set(
        (clients ?? [])
          .flatMap((c) => [
            (c as { user_id?: string }).user_id,
            (c as { profile_id?: string }).profile_id,
          ])
          .filter((v): v is string => typeof v === "string")
      ),
    ];

    const { data: profiles } =
      authIds.length > 0
        ? await admin.from("profiles").select("id, full_name").in("id", authIds)
        : { data: [] as { id: string; full_name: string | null }[] };

    const profileNames = new Map(
      (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
    );

    for (const c of clients ?? []) {
      const userId =
        ((c as { user_id?: string }).user_id ??
          (c as { profile_id?: string }).profile_id) ??
        null;
      clientNameById.set(
        c.id as string,
        clientDisplayName({
          full_name: userId ? (profileNames.get(userId) ?? null) : null,
          contact_email: c.contact_email as string | null,
          id: c.id as string,
        })
      );
    }
  }

  return (data ?? []).map((row) => {
    const embed = row.service_activity_types as
      | { code: string; name: string; category: string }
      | { code: string; name: string; category: string }[]
      | null;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    const minutes = row.duration_minutes as number;
    return {
      id: row.id as string,
      es_user_id: row.es_user_id as string,
      client_id: (row.client_id as string | null) ?? null,
      client_name: row.client_id
        ? (clientNameById.get(row.client_id as string) ?? null)
        : null,
      activity_type_id: row.activity_type_id as string,
      activity_code: activity?.code ?? "",
      activity_name: activity?.name ?? "",
      activity_category: activity?.category ?? "",
      service_date: row.service_date as string,
      duration_minutes: minutes,
      duration_hours: minutesToDecimalHours(minutes),
      service_start_at: (row.service_start_at as string | null) ?? null,
      service_end_at: (row.service_end_at as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      narrative: (row.narrative as string | null) ?? null,
      linked_source_type: (row.linked_source_type as string | null) ?? null,
      status: row.status as string,
      flags: (row.flags as Record<string, boolean>) ?? {},
    };
  });
}

export async function loadWeekSubmission(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string,
  weekStart: string
): Promise<EsWeekSubmissionRow | null> {
  const { data, error } = await admin
    .from("es_time_week_submissions")
    .select(
      "id, es_user_id, week_start, week_end, total_minutes, status, submitted_at, approved_at, supervisor_notes"
    )
    .eq("es_user_id", esUserId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) return null;

  const names = await loadStaffNameById(admin, [esUserId], "ES");

  return {
    id: data.id as string,
    es_user_id: data.es_user_id as string,
    es_name: names.get(esUserId) ?? "ES",
    week_start: data.week_start as string,
    week_end: data.week_end as string,
    total_minutes: data.total_minutes as number,
    status: data.status as string,
    submitted_at: (data.submitted_at as string | null) ?? null,
    approved_at: (data.approved_at as string | null) ?? null,
    supervisor_notes: (data.supervisor_notes as string | null) ?? null,
  };
}

export async function loadPendingWeekSubmissionsForSupervisor(
  admin: ReturnType<typeof createServiceRoleClient>,
  supervisorUserId: string
): Promise<EsWeekSubmissionRow[]> {
  const scope = await loadSupervisorScope(admin, supervisorUserId);
  const esIds = [...new Set(scope.esUserIds)].filter((id) => id !== supervisorUserId);
  if (esIds.length === 0) return [];

  const { data, error } = await admin
    .from("es_time_week_submissions")
    .select(
      "id, es_user_id, week_start, week_end, total_minutes, status, submitted_at, approved_at, supervisor_notes"
    )
    .in("es_user_id", esIds)
    .in("status", ["submitted"])
    .order("week_start", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const nameById = await loadStaffNameById(admin, esIds, "ES");

  return (data ?? []).map((row) => ({
    id: row.id as string,
    es_user_id: row.es_user_id as string,
    es_name: nameById.get(row.es_user_id as string) ?? "ES",
    week_start: row.week_start as string,
    week_end: row.week_end as string,
    total_minutes: row.total_minutes as number,
    status: row.status as string,
    submitted_at: (row.submitted_at as string | null) ?? null,
    approved_at: (row.approved_at as string | null) ?? null,
    supervisor_notes: (row.supervisor_notes as string | null) ?? null,
  }));
}

export function summarizeTimeEntries(entries: EsTimeEntryRow[]) {
  const byClient = new Map<
    string,
    { clientId: string | null; name: string; minutes: number; count: number }
  >();
  const byActivity = new Map<string, { name: string; minutes: number; count: number }>();
  const billableMinutes = sumBillableMinutes(entries);
  const workedMinutes = workedMinutesFromEntries(entries);

  for (const e of entries) {
    const clientKey = e.client_id ?? "non-client";
    const clientName = e.client_name ?? "Non-client time";
    const clientRow = byClient.get(clientKey) ?? {
      clientId: e.client_id,
      name: clientName,
      minutes: 0,
      count: 0,
    };
    clientRow.minutes += e.duration_minutes;
    clientRow.count += 1;
    byClient.set(clientKey, clientRow);

    const actRow = byActivity.get(e.activity_type_id) ?? {
      name: e.activity_name,
      minutes: 0,
      count: 0,
    };
    actRow.minutes += e.duration_minutes;
    actRow.count += 1;
    byActivity.set(e.activity_type_id, actRow);
  }

  return {
    /** @deprecated Prefer billableMinutes — kept for older callers. */
    totalMinutes: billableMinutes,
    billableMinutes,
    workedMinutes,
    byClient: [...byClient.values()].sort((a, b) => b.minutes - a.minutes),
    byActivity: [...byActivity.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

export function esTimeEntriesToCsv(entries: EsTimeEntryRow[], esName: string, weekStart: string): string {
  const header = [
    "week_start",
    "es_name",
    "service_date",
    "client_name",
    "activity_code",
    "activity_name",
    "billable_minutes",
    "billable_hours",
    "start_time",
    "end_time",
    "narrative",
    "status",
    "linked_source_type",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...entries.map((e) => {
      const times = displayServiceTimes(e);
      return [
        weekStart,
        esName,
        e.service_date,
        e.client_name ?? "",
        e.activity_code,
        e.activity_name,
        String(e.duration_minutes),
        e.duration_hours,
        times.start,
        times.end,
        e.narrative ?? "",
        e.status,
        e.linked_source_type ?? "",
      ]
        .map((v) => escape(String(v)))
        .join(",");
    }),
  ];
  const summary = summarizeTimeEntries(entries);
  lines.push("");
  lines.push(
    [
      "SUMMARY",
      esName,
      "",
      "",
      "",
      "hours_worked_payroll",
      String(summary.workedMinutes),
      minutesToDecimalHours(summary.workedMinutes),
      "",
      "",
      "Overlapping clock time counted once",
      "",
      "",
    ]
      .map((v) => escape(String(v)))
      .join(",")
  );
  lines.push(
    [
      "SUMMARY",
      esName,
      "",
      "",
      "",
      "billable_hours_by_client_sum",
      String(summary.billableMinutes),
      minutesToDecimalHours(summary.billableMinutes),
      "",
      "",
      "May exceed hours worked when the same clock time is billed to multiple clients",
      "",
      "",
    ]
      .map((v) => escape(String(v)))
      .join(",")
  );
  return lines.join("\n");
}

export function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekStartSunday(d);
}

export type SupervisedEsOption = { id: string; name: string };

export type TimesheetClientOption = { id: string; name: string };

/** Caseload clients for an ES (for timesheet client filter). */
export async function loadEsCaseloadClientOptions(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string
): Promise<TimesheetClientOption[]> {
  const { data: links } = await admin
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", esUserId);

  const clientIds = [...new Set((links ?? []).map((l) => l.client_id as string))];
  if (clientIds.length === 0) {
    return [];
  }

  let clientRows: Array<{
    id: string;
    contact_email: string | null;
    user_id?: string | null;
    profile_id?: string | null;
    full_name?: string | null;
  }> = [];

  {
    const withName = await admin
      .from("clients")
      .select("id, contact_email, user_id, profile_id, full_name")
      .in("id", clientIds);
    if (withName.error) {
      const fallback = await admin
        .from("clients")
        .select("id, contact_email, user_id, profile_id")
        .in("id", clientIds);
      clientRows = (fallback.data ?? []) as typeof clientRows;
    } else {
      clientRows = (withName.data ?? []) as typeof clientRows;
    }
  }

  const authIds = [
    ...new Set(
      clientRows
        .flatMap((c) => [c.user_id, c.profile_id])
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const { data: profiles } = authIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", authIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  const nameByAuth = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
  );

  return clientRows
    .map((c) => {
      const authId = (c.user_id ?? c.profile_id) ?? null;
      return {
        id: c.id,
        name: clientDisplayName({
          full_name: (authId ? nameByAuth.get(authId) ?? null : null) ?? (c.full_name ?? null),
          contact_email: c.contact_email,
          id: c.id,
        }),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function loadSupervisedEsOptions(
  admin: ReturnType<typeof createServiceRoleClient>,
  supervisorUserId: string
): Promise<SupervisedEsOption[]> {
  const scope = await loadSupervisorScope(admin, supervisorUserId);
  const esIds = [...new Set(scope.esUserIds)].filter((id) => id !== supervisorUserId);
  if (esIds.length === 0) {
    return [];
  }

  const [{ data: profiles }, nameById] = await Promise.all([
    admin.from("profiles").select("id, is_active").in("id", esIds).eq("role", "es"),
    loadStaffNameById(admin, esIds, "Employment Specialist"),
  ]);

  return (profiles ?? [])
    .map((p) => {
      const name = nameById.get(p.id as string) ?? "Employment Specialist";
      const inactive = p.is_active === false ? " (inactive)" : "";
      return { id: p.id as string, name: `${name}${inactive}` };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

export async function loadStaffEsPickerOptions(
  admin: ReturnType<typeof createServiceRoleClient>,
  role: string,
  userId: string
): Promise<SupervisedEsOption[]> {
  if (isSupervisorRole(role) && !isAdminTierRole(role)) {
    return loadSupervisedEsOptions(admin, userId);
  }

  if (isAdminTierRole(role) || role === "accountant" || role === "hr") {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, is_active")
      .eq("role", "es");

    const ids = (profiles ?? []).map((p) => p.id as string);
    const nameById = await loadStaffNameById(admin, ids, "Employment Specialist");

    return (profiles ?? [])
      .map((p) => {
        const name = nameById.get(p.id as string) ?? "Employment Specialist";
        const inactive = p.is_active === false ? " (inactive)" : "";
        return { id: p.id as string, name: `${name}${inactive}` };
      })
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }

  return [];
}

export type { ServiceActivityType };
