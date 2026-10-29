import {
  formatBillableHours,
  sumBillableMinutesFromTimeEntryRows,
} from "@wayfinder/supabase/client-billable";
import {
  minutesToDecimalHours,
  weekEndSaturday,
  weekStartSunday,
  displayServiceTimes,
  type ServiceActivityType,
} from "@wayfinder/supabase/es-time-tracking";
import {
  localDateStringInTz,
  STAFF_CLOCK_TIMEZONE,
} from "@wayfinder/supabase/staff-time-clock-shared";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { shiftDurationMinutes } from "@wayfinder/supabase/staff-time-clock-shared";
import { loadStaffNameById } from "@/lib/staff-names";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import {
  summarizeTimeEntries,
  type EsTimeEntryRow,
  type EsWeekSubmissionRow,
  type SupervisedEsOption,
  type TimesheetClientOption,
} from "@/lib/es-time-client";

export type {
  EsTimeEntryRow,
  EsWeekSubmissionRow,
  SupervisedEsOption,
  TimesheetClientOption,
} from "@/lib/es-time-client";
export { summarizeTimeEntries, shiftWeekStart } from "@/lib/es-time-client";
export type { ServiceActivityType };
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
      client_present,
      delivery_mode,
      service_activity_types ( code, name, category, counts_toward_client_billable )
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

  const clientNameById = await loadClientDisplayNameById(admin, clientIds);

  return (data ?? []).map((row) => {
    const embed = row.service_activity_types as
      | {
          code: string;
          name: string;
          category: string;
          counts_toward_client_billable?: boolean;
        }
      | {
          code: string;
          name: string;
          category: string;
          counts_toward_client_billable?: boolean;
        }[]
      | null;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    const minutes = row.duration_minutes as number;
    const countsTowardClient =
      activity?.counts_toward_client_billable !== false;
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
      counts_toward_client_billable: countsTowardClient,
      service_date: row.service_date as string,
      duration_minutes: minutes,
      duration_hours: formatBillableHours(minutes),
      client_billable_hours: countsTowardClient ? formatBillableHours(minutes) : "0.0",
      service_start_at: (row.service_start_at as string | null) ?? null,
      service_end_at: (row.service_end_at as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
      narrative: (row.narrative as string | null) ?? null,
      linked_source_type: (row.linked_source_type as string | null) ?? null,
      status: row.status as string,
      flags: (row.flags as Record<string, boolean>) ?? {},
      client_present: (row.client_present as boolean | null) ?? null,
      delivery_mode: (row.delivery_mode as string | null) ?? null,
    };
  });
}

export async function loadBillableMinutesForDateRange(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<number> {
  const { data, error } = await admin
    .from("es_time_entries")
    .select(
      "duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )"
    )
    .eq("es_user_id", esUserId)
    .gte("service_date", rangeStart)
    .lte("service_date", rangeEnd)
    .neq("status", "rejected");

  if (error) {
    throw new Error(error.message);
  }

  return sumBillableMinutesFromTimeEntryRows(
    (data ?? []).map((row) => ({
      duration_minutes: row.duration_minutes as number,
      flags: (row.flags as Record<string, boolean>) ?? {},
      service_activity_types: row.service_activity_types as
        | { code: string; counts_toward_client_billable?: boolean }
        | { code: string; counts_toward_client_billable?: boolean }[]
        | null,
    }))
  );
}

export type MyBillableHoursSummary = {
  today: string;
  thisWeekStart: string;
  thisWeekEnd: string;
  thisWeekMinutes: number;
  lastWeekStart: string;
  lastWeekEnd: string;
  lastWeekMinutes: number;
  monthStart: string;
  monthEnd: string;
  monthLabel: string;
  monthMinutes: number;
};

function monthStartYmd(todayYmd: string): string {
  const [y, m] = todayYmd.split("-");
  return `${y}-${m}-01`;
}

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Inclusive calendar-month bounds (YYYY-MM-DD) for a `YYYY-MM` key. */
export function calendarMonthBoundsFromKey(monthKey: string): { start: string; end: string } {
  const match = MONTH_KEY_RE.exec(monthKey.trim());
  if (!match) {
    throw new Error("Invalid month (expected YYYY-MM)");
  }
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const lastDayUtc = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const end = `${lastDayUtc.getUTCFullYear()}-${String(lastDayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDayUtc.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

/** Prior calendar month in America/New_York (for payroll on the 1st). */
export function defaultPayrollMonthKey(now: Date = new Date()): string {
  const today = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const thisMonthStart = monthStartYmd(today);
  const lastDayPrev = addCalendarDaysYmd(thisMonthStart, -1);
  return lastDayPrev.slice(0, 7);
}

export function monthLabelFromKey(monthKey: string): string {
  const { start } = calendarMonthBoundsFromKey(monthKey);
  return monthLabelFromYmd(start);
}

export type OrgMonthlyBillableHoursRow = {
  staffUserId: string;
  staffName: string;
  billableMinutes: number;
  billableHours: string;
};

/**
 * Billable minutes by staff for a calendar month (non-rejected; excludes note-only / case file review).
 * Intentionally not filtered by client archive, terminal stage, or service line — any logged time
 * in the month counts toward the ES/TS payroll rollup.
 */
export async function loadOrgMonthlyBillableHoursRollup(
  admin: ReturnType<typeof createServiceRoleClient>,
  monthKey: string
): Promise<{ monthKey: string; monthLabel: string; range: { start: string; end: string }; rows: OrgMonthlyBillableHoursRow[] }> {
  const { start, end } = calendarMonthBoundsFromKey(monthKey);
  const staff = await loadOrgBillableHoursStaffPicker(admin);
  const staffIds = staff.map((s) => s.id);

  let query = admin
    .from("es_time_entries")
    .select(
      "es_user_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )"
    )
    .gte("service_date", start)
    .lte("service_date", end)
    .neq("status", "rejected");

  if (staffIds.length > 0) {
    query = query.in("es_user_id", staffIds);
  }

  const { data: entries, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const minutesById = new Map<string, number>();
  for (const s of staff) {
    minutesById.set(s.id, 0);
  }
  for (const row of entries ?? []) {
    const id = row.es_user_id as string;
    const add = sumBillableMinutesFromTimeEntryRows([
      {
        duration_minutes: Number(row.duration_minutes) || 0,
        flags: (row.flags as Record<string, boolean>) ?? {},
        service_activity_types: row.service_activity_types as
          | { code: string; counts_toward_client_billable?: boolean }
          | { code: string; counts_toward_client_billable?: boolean }[]
          | null,
      },
    ]);
    minutesById.set(id, (minutesById.get(id) ?? 0) + add);
  }

  const nameById = await loadStaffNameById(admin, [...minutesById.keys()], "Team member");
  const staffNameById = new Map(staff.map((s) => [s.id, s.name]));

  const rows: OrgMonthlyBillableHoursRow[] = [...minutesById.entries()]
    .map(([staffUserId, billableMinutes]) => ({
      staffUserId,
      staffName: staffNameById.get(staffUserId) ?? nameById.get(staffUserId) ?? "Team member",
      billableMinutes,
      billableHours: formatBillableHours(billableMinutes),
    }))
    .sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" }));

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    range: { start, end },
    rows,
  };
}

function monthLabelFromYmd(monthStart: string): string {
  const [y, m, d] = monthStart.split("-").map(Number);
  if (!y || !m || !d) return monthStart;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

function addCalendarDaysYmd(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

export async function loadMyBillableHoursSummary(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string,
  now: Date = new Date()
): Promise<MyBillableHoursSummary> {
  const today = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const thisWeekStart = weekStartSunday(today);
  const thisWeekEnd = weekEndSaturday(thisWeekStart);
  const lastWeekStart = addCalendarDaysYmd(thisWeekStart, -7);
  const lastWeekEnd = weekEndSaturday(lastWeekStart);
  const monthStart = monthStartYmd(today);

  const [thisWeekMinutes, lastWeekMinutes, monthMinutes] = await Promise.all([
    loadBillableMinutesForDateRange(admin, esUserId, thisWeekStart, thisWeekEnd),
    loadBillableMinutesForDateRange(admin, esUserId, lastWeekStart, lastWeekEnd),
    loadBillableMinutesForDateRange(admin, esUserId, monthStart, today),
  ]);

  return {
    today,
    thisWeekStart,
    thisWeekEnd,
    thisWeekMinutes,
    lastWeekStart,
    lastWeekEnd,
    lastWeekMinutes,
    monthStart,
    monthEnd: today,
    monthLabel: monthLabelFromYmd(monthStart),
    monthMinutes,
  };
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

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, is_demo")
    .in("id", clientIds);

  const productionIds = (clientRows ?? [])
    .filter((c) => c.is_demo !== true)
    .map((c) => c.id as string);

  const nameById = await loadClientDisplayNameById(admin, productionIds);
  return productionIds
    .map((id) => ({
      id,
      name: nameById.get(id) ?? "Unknown client",
    }))
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
    admin
      .from("profiles")
      .select("id, is_active, role")
      .in("id", esIds)
      .in("role", ["es", "transition_specialist", "supervisor"])
      .neq("is_active", false),
    loadStaffNameById(admin, esIds, "Team member"),
  ]);

  return (profiles ?? [])
    .map((p) => {
      const name = nameById.get(p.id as string) ?? "Employment Specialist";
      return { id: p.id as string, name };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function roleSuffixLabel(role: string | null | undefined): string {
  if (role === "supervisor") return " (Supervisor)";
  if (role === "transition_specialist") return " (TS)";
  if (role === "admin" || role === "super_admin") return " (Admin)";
  return "";
}

export async function loadOrgBillableHoursStaffPicker(
  admin: ReturnType<typeof createServiceRoleClient>
): Promise<SupervisedEsOption[]> {
  const fieldRoles = ["es", "transition_specialist", "supervisor"] as const;

  const [{ data: fieldProfiles }, { data: assignmentRows }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, is_active, role")
      .in("role", [...fieldRoles])
      .neq("is_active", false),
    admin.from("es_client_assignments").select("es_user_id"),
  ]);

  const assignedStaffIds = [
    ...new Set((assignmentRows ?? []).map((r) => r.es_user_id as string).filter(Boolean)),
  ];

  let adminAssignees: { id: string; is_active: boolean | null; role: string | null }[] = [];
  if (assignedStaffIds.length > 0) {
    const { data } = await admin
      .from("profiles")
      .select("id, is_active, role")
      .in("id", assignedStaffIds)
      .in("role", ["admin", "super_admin"])
      .neq("is_active", false);
    adminAssignees = data ?? [];
  }

  const byId = new Map<string, { id: string; role: string | null }>();
  for (const p of fieldProfiles ?? []) {
    byId.set(p.id as string, { id: p.id as string, role: p.role as string | null });
  }
  for (const p of adminAssignees) {
    byId.set(p.id as string, { id: p.id as string, role: p.role as string | null });
  }

  const ids = [...byId.keys()];
  const nameById = await loadStaffNameById(admin, ids, "Team member");

  return ids
    .map((id) => {
      const role = byId.get(id)?.role ?? null;
      const name = nameById.get(id) ?? "Team member";
      return { id, name: `${name}${roleSuffixLabel(role)}` };
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
    return loadOrgBillableHoursStaffPicker(admin);
  }

  return [];
}

/** Closed + open Time Clock minutes for a staff member in a Sun–Sat local-date week. */
export async function loadStaffClockMinutesForWeek(
  admin: ReturnType<typeof createServiceRoleClient>,
  staffUserId: string,
  weekStart: string
): Promise<number> {
  const weekEnd = weekEndSaturday(weekStart);
  const { data: shifts, error } = await admin
    .from("staff_time_clock_shifts")
    .select("clock_in_at, clock_out_at")
    .eq("staff_user_id", staffUserId)
    .gte("local_date", weekStart)
    .lte("local_date", weekEnd);

  if (error) {
    throw new Error(error.message);
  }

  const now = new Date();
  return (shifts ?? []).reduce(
    (sum, s) =>
      sum +
      shiftDurationMinutes(
        s.clock_in_at as string,
        (s.clock_out_at as string | null) ?? null,
        now
      ),
    0
  );
}
