import { serviceDisplayName } from "@wayfinder/branding";
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
  findEpisodeCoveringServiceDate,
  type IjpAttributionEpisode,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import {
  localDateStringInTz,
  STAFF_CLOCK_TIMEZONE,
} from "@wayfinder/supabase/staff-time-clock-shared";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  buildBillableMonthWeekBuckets,
  hoursDeltaLabel,
  priorMonthKeyFrom,
  type BillableMonthWeekBucket,
} from "@wayfinder/supabase/billable-month-comparisons";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { loadStaffNameById } from "@/lib/staff-names";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import {
  buildOrgMonthlyBillableHoursRows,
  countsTowardBillableHoursTotals,
  type OrgBillableLoggerProfile,
  type OrgMonthlyBillableHoursRow,
} from "@/lib/org-billable-hours-rollup";
import {
  summarizeTimeEntries,
  type EsTimeEntryRow,
  type SupervisedEsOption,
  type TimesheetClientOption,
} from "@/lib/es-time-client";

export type { OrgMonthlyBillableHoursRow, OrgBillableRosterStatus } from "@/lib/org-billable-hours-rollup";

export type {
  EsTimeEntryRow,
  EsWeekSubmissionRow,
  SupervisedEsOption,
  TimesheetClientOption,
  ClientServiceBillableGroup,
} from "@/lib/es-time-client";
export {
  summarizeTimeEntries,
  summarizeTimeEntriesByClientService,
  shiftWeekStart,
  shiftMonthKey,
} from "@/lib/es-time-client";
export type { ServiceActivityType };

type AdminClient = ReturnType<typeof createServiceRoleClient>;

type RawTimeEntryRow = {
  id: string;
  es_user_id: string;
  client_id: string | null;
  activity_type_id: string;
  service_date: string;
  duration_minutes: number;
  service_start_at: string | null;
  service_end_at: string | null;
  created_at: string | null;
  narrative: string | null;
  linked_source_type: string | null;
  status: string;
  flags: Record<string, boolean> | null;
  client_present: boolean | null;
  delivery_mode: string | null;
  service_episode_id: string | null;
  service_activity_types:
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
};

const TIME_ENTRY_SELECT = `
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
  service_episode_id,
  service_activity_types ( code, name, category, counts_toward_client_billable )
`;

async function resolveServiceLabelsForEntries(
  admin: AdminClient,
  rows: RawTimeEntryRow[]
): Promise<Map<string, { serviceId: string | null; serviceName: string | null }>> {
  const labels = new Map<string, { serviceId: string | null; serviceName: string | null }>();
  if (rows.length === 0) return labels;

  const clientIds = [
    ...new Set(
      rows
        .map((r) => r.client_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const episodeIds = [
    ...new Set(
      rows
        .map((r) => r.service_episode_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];

  const [{ data: clientRows }, { data: linkedEpisodes }, { data: clientEpisodes }] =
    await Promise.all([
      clientIds.length > 0
        ? admin.from("clients").select("id, current_service_id").in("id", clientIds)
        : Promise.resolve({ data: [] as Array<{ id: string; current_service_id: string | null }> }),
      episodeIds.length > 0
        ? admin
            .from("service_episodes")
            .select("id, service_id, started_at, ended_at, client_id")
            .in("id", episodeIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              service_id: string | null;
              started_at: string | null;
              ended_at: string | null;
              client_id: string;
            }>,
          }),
      clientIds.length > 0
        ? admin
            .from("service_episodes")
            .select("id, service_id, started_at, ended_at, client_id")
            .in("client_id", clientIds)
        : Promise.resolve({
            data: [] as Array<{
              id: string;
              service_id: string | null;
              started_at: string | null;
              ended_at: string | null;
              client_id: string;
            }>,
          }),
    ]);

  const currentServiceByClient = new Map<string, string | null>();
  for (const c of clientRows ?? []) {
    currentServiceByClient.set(c.id as string, (c.current_service_id as string | null) ?? null);
  }

  const episodeById = new Map<string, IjpAttributionEpisode & { client_id?: string }>();
  const episodesByClient = new Map<string, IjpAttributionEpisode[]>();

  for (const ep of [...(linkedEpisodes ?? []), ...(clientEpisodes ?? [])]) {
    const mapped: IjpAttributionEpisode & { client_id?: string } = {
      id: ep.id as string,
      service_id: (ep.service_id as string | null) ?? null,
      started_at: (ep.started_at as string | null) ?? null,
      ended_at: (ep.ended_at as string | null) ?? null,
      client_id: ep.client_id as string,
    };
    episodeById.set(ep.id as string, mapped);
    const list = episodesByClient.get(ep.client_id as string) ?? [];
    if (!list.some((existing) => existing.id === mapped.id)) {
      list.push(mapped);
    }
    episodesByClient.set(ep.client_id as string, list);
  }

  const serviceIds = new Set<string>();
  const resolvedServiceIdByEntry = new Map<string, string | null>();

  for (const row of rows) {
    let serviceId: string | null = null;
    const linkedId = row.service_episode_id;
    if (linkedId && episodeById.has(linkedId)) {
      serviceId = episodeById.get(linkedId)?.service_id ?? null;
    } else if (row.client_id) {
      const covering = findEpisodeCoveringServiceDate(
        episodesByClient.get(row.client_id) ?? [],
        row.service_date
      );
      if (covering?.service_id) {
        serviceId = covering.service_id;
      } else {
        serviceId = currentServiceByClient.get(row.client_id) ?? null;
      }
    }
    resolvedServiceIdByEntry.set(row.id, serviceId);
    if (serviceId) serviceIds.add(serviceId);
  }

  const { data: serviceRows } =
    serviceIds.size > 0
      ? await admin
          .from("services")
          .select("id, name, state")
          .in("id", [...serviceIds])
      : { data: [] as Array<{ id: string; name: string; state: string | null }> };

  const serviceNameById = new Map<string, string>();
  for (const s of serviceRows ?? []) {
    serviceNameById.set(
      s.id as string,
      serviceDisplayName({
        id: s.id as string,
        name: s.name as string,
        state: (s.state as string | null) ?? null,
      })
    );
  }

  for (const row of rows) {
    const serviceId = resolvedServiceIdByEntry.get(row.id) ?? null;
    labels.set(row.id, {
      serviceId,
      serviceName: serviceId ? (serviceNameById.get(serviceId) ?? null) : null,
    });
  }

  return labels;
}

async function mapEsTimeEntryRows(
  admin: AdminClient,
  data: RawTimeEntryRow[]
): Promise<EsTimeEntryRow[]> {
  const clientIds = [
    ...new Set(
      data
        .map((r) => r.client_id)
        .filter((id): id is string => typeof id === "string")
    ),
  ];
  const [clientNameById, serviceLabels] = await Promise.all([
    loadClientDisplayNameById(admin, clientIds),
    resolveServiceLabelsForEntries(admin, data),
  ]);

  return data.map((row) => {
    const embed = row.service_activity_types;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    const minutes = row.duration_minutes;
    const countsTowardClient = activity?.counts_toward_client_billable !== false;
    const service = serviceLabels.get(row.id);
    return {
      id: row.id,
      es_user_id: row.es_user_id,
      client_id: row.client_id ?? null,
      client_name: row.client_id ? (clientNameById.get(row.client_id) ?? null) : null,
      activity_type_id: row.activity_type_id,
      activity_code: activity?.code ?? "",
      activity_name: activity?.name ?? "",
      activity_category: activity?.category ?? "",
      counts_toward_client_billable: countsTowardClient,
      service_date: row.service_date,
      duration_minutes: minutes,
      duration_hours: formatBillableHours(minutes),
      client_billable_hours: countsTowardClient ? formatBillableHours(minutes) : "0.0",
      service_start_at: row.service_start_at ?? null,
      service_end_at: row.service_end_at ?? null,
      created_at: row.created_at ?? null,
      narrative: row.narrative ?? null,
      linked_source_type: row.linked_source_type ?? null,
      status: row.status,
      flags: row.flags ?? {},
      client_present: row.client_present ?? null,
      delivery_mode: row.delivery_mode ?? null,
      service_episode_id: row.service_episode_id ?? null,
      service_id: service?.serviceId ?? null,
      service_name: service?.serviceName ?? null,
    };
  });
}

export async function loadEsTimeEntriesForDateRange(
  admin: AdminClient,
  esUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<EsTimeEntryRow[]> {
  const data = await fetchAllPostgrestRows<RawTimeEntryRow>(
    admin,
    "es_time_entries",
    TIME_ENTRY_SELECT,
    {
      order: [
        { column: "service_date", ascending: true },
        { column: "created_at", ascending: true },
        { column: "id", ascending: true },
      ],
      applyFilters: (query) =>
        query
          .eq("es_user_id", esUserId)
          .gte("service_date", rangeStart)
          .lte("service_date", rangeEnd),
    }
  );

  return mapEsTimeEntryRows(admin, data as unknown as RawTimeEntryRow[]);
}

export async function loadEsTimeEntriesForWeek(
  admin: AdminClient,
  esUserId: string,
  weekStart: string
): Promise<EsTimeEntryRow[]> {
  const weekEnd = weekEndSaturday(weekStart);
  return loadEsTimeEntriesForDateRange(admin, esUserId, weekStart, weekEnd);
}

/** Calendar-month entries (YYYY-MM) for the monthly billable hours ledger. */
export async function loadEsTimeEntriesForMonth(
  admin: AdminClient,
  esUserId: string,
  monthKey: string
): Promise<EsTimeEntryRow[]> {
  const { start, end } = calendarMonthBoundsFromKey(monthKey);
  return loadEsTimeEntriesForDateRange(admin, esUserId, start, end);
}

/** Current calendar month key in America/New_York (YYYY-MM). */
export function currentMonthKey(now: Date = new Date()): string {
  const today = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  return today.slice(0, 7);
}

type BillableMinutesRow = {
  client_id: string | null;
  duration_minutes: number;
  flags: Record<string, boolean> | null;
  service_activity_types:
    | { code: string; counts_toward_client_billable?: boolean }
    | { code: string; counts_toward_client_billable?: boolean }[]
    | null;
  clients: { is_demo: boolean | null } | { is_demo: boolean | null }[] | null;
};

function clientIsDemoFromEmbed(
  embed: { is_demo: boolean | null } | { is_demo: boolean | null }[] | null | undefined
): boolean | null {
  if (!embed) return null;
  const row = Array.isArray(embed) ? embed[0] : embed;
  return row?.is_demo ?? null;
}

export async function loadBillableMinutesForDateRange(
  admin: ReturnType<typeof createServiceRoleClient>,
  esUserId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<number> {
  const data = await fetchAllPostgrestRows<BillableMinutesRow>(
    admin,
    "es_time_entries",
    "client_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable ), clients ( is_demo )",
    {
      order: { column: "id", ascending: true },
      applyFilters: (query) =>
        query
          .eq("es_user_id", esUserId)
          .gte("service_date", rangeStart)
          .lte("service_date", rangeEnd)
          .neq("status", "rejected"),
    }
  );

  return sumBillableMinutesFromTimeEntryRows(
    data
      .filter((row) =>
        countsTowardBillableHoursTotals({
          clientId: row.client_id,
          clientIsDemo: clientIsDemoFromEmbed(row.clients),
        })
      )
      .map((row) => ({
        duration_minutes: row.duration_minutes as number,
        flags: (row.flags as Record<string, boolean>) ?? {},
        service_activity_types: row.service_activity_types,
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

type OrgMonthEntryRow = {
  es_user_id: string;
  client_id: string | null;
  service_date: string;
  duration_minutes: number;
  flags: Record<string, boolean> | null;
  service_activity_types:
    | { code: string; counts_toward_client_billable?: boolean }
    | { code: string; counts_toward_client_billable?: boolean }[]
    | null;
  clients: { is_demo: boolean | null } | { is_demo: boolean | null }[] | null;
};

export type OrgMonthlyBillableHoursPayload = {
  monthKey: string;
  monthLabel: string;
  range: { start: string; end: string };
  rows: Array<
    OrgMonthlyBillableHoursRow & {
      expectedBillableMinutes: number;
      expectedBillableHours: string;
      priorMonthMinutes: number;
      priorMonthHours: string;
      deltaVsPriorMinutes: number;
      deltaVsPriorHours: string;
      deltaVsExpectedMinutes: number;
      deltaVsExpectedHours: string;
    }
  >;
  orgTotalMinutes: number;
  orgTotalHours: string;
  priorMonthKey: string;
  priorMonthLabel: string;
  priorMonthMinutes: number;
  priorMonthHours: string;
  deltaVsPriorMinutes: number;
  deltaVsPriorHours: string;
  weeks: BillableMonthWeekBucket[];
};

async function loadOrgMonthBillableMinutesByStaff(
  admin: ReturnType<typeof createServiceRoleClient>,
  monthKey: string
): Promise<{
  start: string;
  end: string;
  minutesById: Map<string, number>;
  weekEntries: Array<{ service_date: string; billableMinutes: number }>;
}> {
  const { start, end } = calendarMonthBoundsFromKey(monthKey);
  const entries = await fetchAllPostgrestRows<OrgMonthEntryRow>(
    admin,
    "es_time_entries",
    "es_user_id, client_id, service_date, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable ), clients ( is_demo )",
    {
      order: { column: "id", ascending: true },
      applyFilters: (query) =>
        query
          .gte("service_date", start)
          .lte("service_date", end)
          .neq("status", "rejected"),
    }
  );

  const minutesById = new Map<string, number>();
  const weekEntries: Array<{ service_date: string; billableMinutes: number }> = [];
  for (const row of entries) {
    if (
      !countsTowardBillableHoursTotals({
        clientId: row.client_id,
        clientIsDemo: clientIsDemoFromEmbed(row.clients),
      })
    ) {
      continue;
    }
    const add = sumBillableMinutesFromTimeEntryRows([
      {
        duration_minutes: Number(row.duration_minutes) || 0,
        flags: (row.flags as Record<string, boolean>) ?? {},
        service_activity_types: row.service_activity_types,
      },
    ]);
    if (add <= 0) continue;
    const id = row.es_user_id as string;
    minutesById.set(id, (minutesById.get(id) ?? 0) + add);
    weekEntries.push({ service_date: row.service_date, billableMinutes: add });
  }
  return { start, end, minutesById, weekEntries };
}

/**
 * Billable minutes by staff for a calendar month (non-rejected; excludes note-only / case file review).
 * Counts every non-rejected billable entry in the month — including former team members and
 * mis-assigned non-staff loggers — so past months stay complete after deactivation.
 * Demo clients (is_demo) are excluded. The live roster is used only to list zero-hour team members.
 * Includes week-by-week org buckets and vs-prior-month hour deltas (not percentages).
 */
export async function loadOrgMonthlyBillableHoursRollup(
  admin: ReturnType<typeof createServiceRoleClient>,
  monthKey: string,
  opts?: { expectedMinutesByStaffId?: Map<string, number> }
): Promise<OrgMonthlyBillableHoursPayload> {
  const staff = await loadOrgBillableHoursStaffPicker(admin);
  const priorKey = priorMonthKeyFrom(monthKey);
  const [current, prior] = await Promise.all([
    loadOrgMonthBillableMinutesByStaff(admin, monthKey),
    loadOrgMonthBillableMinutesByStaff(admin, priorKey),
  ]);

  const profileIds = [
    ...new Set([
      ...staff.map((s) => s.id),
      ...current.minutesById.keys(),
      ...prior.minutesById.keys(),
    ]),
  ];
  const [{ data: profileRows }, nameById] = await Promise.all([
    profileIds.length > 0
      ? admin.from("profiles").select("id, role, is_active").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; role: string | null; is_active: boolean | null }[] }),
    loadStaffNameById(admin, profileIds, "Team member"),
  ]);

  const roleActiveById = new Map(
    (profileRows ?? []).map((p) => [
      p.id as string,
      {
        role: (p.role as string | null) ?? null,
        isActive: (p.is_active as boolean | null) ?? null,
      },
    ])
  );
  const profileById = new Map<string, OrgBillableLoggerProfile>();
  for (const id of profileIds) {
    const meta = roleActiveById.get(id);
    profileById.set(id, {
      role: meta?.role ?? null,
      isActive: meta?.isActive ?? null,
      displayName: nameById.get(id) ?? "Team member",
    });
  }

  const baseRows = buildOrgMonthlyBillableHoursRows({
    liveRoster: staff,
    minutesByUserId: current.minutesById,
    profileById,
  });

  const expectedById = opts?.expectedMinutesByStaffId ?? new Map<string, number>();
  const rows = baseRows.map((row) => {
    const priorMonthMinutes = prior.minutesById.get(row.staffUserId) ?? 0;
    const expectedBillableMinutes = expectedById.get(row.staffUserId) ?? 0;
    const vsPrior = hoursDeltaLabel(row.billableMinutes, priorMonthMinutes);
    const vsExpected = hoursDeltaLabel(row.billableMinutes, expectedBillableMinutes);
    return {
      ...row,
      expectedBillableMinutes,
      expectedBillableHours: formatBillableHours(expectedBillableMinutes),
      priorMonthMinutes,
      priorMonthHours: formatBillableHours(priorMonthMinutes),
      deltaVsPriorMinutes: vsPrior.deltaMinutes,
      deltaVsPriorHours: vsPrior.deltaHours,
      deltaVsExpectedMinutes: vsExpected.deltaMinutes,
      deltaVsExpectedHours: vsExpected.deltaHours,
    };
  });

  const orgTotalMinutes = rows.reduce((s, r) => s + r.billableMinutes, 0);
  const priorMonthMinutes = [...prior.minutesById.values()].reduce((s, n) => s + n, 0);
  const orgVsPrior = hoursDeltaLabel(orgTotalMinutes, priorMonthMinutes);
  const weeks = buildBillableMonthWeekBuckets({
    rangeStart: current.start,
    rangeEnd: current.end,
    entries: current.weekEntries,
  });

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    range: { start: current.start, end: current.end },
    rows,
    orgTotalMinutes,
    orgTotalHours: formatBillableHours(orgTotalMinutes),
    priorMonthKey: priorKey,
    priorMonthLabel: monthLabelFromKey(priorKey),
    priorMonthMinutes,
    priorMonthHours: formatBillableHours(priorMonthMinutes),
    deltaVsPriorMinutes: orgVsPrior.deltaMinutes,
    deltaVsPriorHours: orgVsPrior.deltaHours,
    weeks,
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



export function esTimeEntriesToCsv(
  entries: EsTimeEntryRow[],
  esName: string,
  periodLabel: string,
  opts?: { periodColumn?: string }
): string {
  const periodColumn = opts?.periodColumn ?? "week_start";
  const header = [
    periodColumn,
    "es_name",
    "service_date",
    "client_name",
    "service_name",
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
        periodLabel,
        esName,
        e.service_date,
        e.client_name ?? "",
        e.service_name ?? "",
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

