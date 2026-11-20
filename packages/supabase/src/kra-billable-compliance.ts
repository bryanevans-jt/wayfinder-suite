import type { SupabaseClient } from "@supabase/supabase-js";
import {
  formatBillableHours,
  isGvraMonthlyAllowanceEntry,
  sumBillableMinutesFromTimeEntryRows,
} from "./client-billable";
import {
  buildAssigneeIdsByClientFromEvents,
  buildLastAssigneeByClientFromEvents,
  calendarMonthBoundsFromKey,
  type AssignmentEventRow,
} from "./es-client-assignment-events";
import {
  expectedBillableMinutesForClients,
  formatExpectedBillableHours,
} from "./kra-billable-expected";
import {
  buildKraUncountedHoursBreakdown,
  classifyPayrollEntryForKra,
  type KraUncountedHoursBreakdown,
} from "./kra-uncounted-hours";
import {
  loadKraBillableSettings,
  serviceIdsInKraScope,
  thresholdHoursForService,
  type KraBillableSettingsRow,
} from "./kra-billable-settings";
import { fetchAllPostgrestRows, fetchAllPostgrestRowsByIn } from "./postgrest-fetch-all";
import { isStaffRole } from "./roles";

/** Roles that appear on the KRA roster (active profiles). */
export const KRA_ROSTER_ROLES = ["es", "transition_specialist", "supervisor"] as const;

export type KraClientComplianceRow = {
  clientId: string;
  clientName: string;
  serviceId: string | null;
  thresholdHours: number;
  kraBillableMinutes: number;
  kraBillableHours: string;
  loggedBySelfMinutes: number;
  loggedByOthersMinutes: number;
  gvraAllowanceMinutes: number;
  met: boolean;
  lastAssigneeInMonthUserId: string | null;
};

export type KraStaffComplianceRow = {
  staffUserId: string;
  staffName: string;
  role: string | null;
  inScopeClientCount: number;
  metCount: number;
  missedCount: number;
  complianceLabel: string;
  averageBillableHoursPerClient: string;
  expectedBillableMinutes: number;
  expectedBillableHours: string;
  clients: KraClientComplianceRow[];
};

export type KraBillableComplianceRollup = {
  monthKey: string;
  monthLabel: string;
  range: { start: string; end: string };
  frozen: boolean;
  closedAt: string | null;
  settings: Pick<
    KraBillableSettingsRow,
    "count_system_allowance_toward_kra" | "successor_inherits_client_month_hours"
  >;
  rows: KraStaffComplianceRow[];
  uncounted: KraUncountedHoursBreakdown;
};

function monthLabelFromKey(monthKey: string): string {
  const { start } = calendarMonthBoundsFromKey(monthKey);
  const [y, m, d] = start.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

type TimeRow = {
  es_user_id: string;
  client_id: string | null;
  duration_minutes: number;
  flags: Record<string, boolean> | null;
  service_activity_types:
    | { code: string; counts_toward_client_billable?: boolean }
    | { code: string; counts_toward_client_billable?: boolean }[]
    | null;
};

function billableMinutesForKraRow(row: TimeRow, settings: KraBillableSettingsRow): number {
  if (!settings.count_system_allowance_toward_kra && isGvraMonthlyAllowanceEntry(row)) {
    return 0;
  }
  return sumBillableMinutesFromTimeEntryRows([row]);
}

function emptyUncounted(): KraUncountedHoursBreakdown {
  return buildKraUncountedHoursBreakdown([]);
}

export async function loadKraBillableMonthSnapshot(
  admin: SupabaseClient,
  monthKey: string
): Promise<KraBillableComplianceRollup | null> {
  const { data } = await admin
    .from("kra_billable_month_snapshots")
    .select("payload, closed_at")
    .eq("month_key", monthKey)
    .maybeSingle();
  if (!data?.payload) return null;
  const payload = data.payload as KraBillableComplianceRollup;
  return {
    ...payload,
    frozen: true,
    closedAt: (data.closed_at as string) ?? null,
    uncounted: payload.uncounted ?? emptyUncounted(),
    rows: (payload.rows ?? []).map((r) => ({
      ...r,
      role: r.role ?? null,
      expectedBillableMinutes: r.expectedBillableMinutes ?? 0,
      expectedBillableHours:
        r.expectedBillableHours ?? formatExpectedBillableHours(r.expectedBillableMinutes ?? 0),
    })),
  };
}

export async function saveKraBillableMonthSnapshot(
  admin: SupabaseClient,
  monthKey: string,
  payload: KraBillableComplianceRollup,
  closedByUserId: string
): Promise<void> {
  const { error } = await admin.from("kra_billable_month_snapshots").upsert(
    {
      month_key: monthKey,
      payload: { ...payload, frozen: true },
      closed_at: new Date().toISOString(),
      closed_by: closedByUserId,
    },
    { onConflict: "month_key" }
  );
  if (error) {
    throw new Error(error.message);
  }
}

export async function loadKraBillableComplianceRollup(
  admin: SupabaseClient,
  monthKey: string,
  nameByStaffId: Map<string, string>,
  nameByClientId: Map<string, string>
): Promise<KraBillableComplianceRollup> {
  const snapshot = await loadKraBillableMonthSnapshot(admin, monthKey);
  if (snapshot) {
    return snapshot;
  }

  const settings = await loadKraBillableSettings(admin);
  const inScopeServiceIds = serviceIdsInKraScope(settings);
  const { start, end } = calendarMonthBoundsFromKey(monthKey);

  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .in("role", [...KRA_ROSTER_ROLES])
    .neq("is_active", false);

  const staffMeta = new Map(
    (staffProfiles ?? []).map((p) => [
      p.id as string,
      { role: (p.role as string | null) ?? null },
    ])
  );
  const liveStaffIds = [...staffMeta.keys()];
  const staffIdSet = new Set(liveStaffIds);

  if (inScopeServiceIds.size === 0) {
    return emptyRollup(monthKey, start, end, settings, liveStaffIds, nameByStaffId, staffMeta);
  }

  const assignmentEvents = await fetchAllPostgrestRows<AssignmentEventRow>(
    admin,
    "es_client_assignment_events",
    "client_id, es_user_id, effective_at",
    {
      order: [
        { column: "effective_at", ascending: true },
        { column: "client_id", ascending: true },
      ],
      applyFilters: (query) => query.lte("effective_at", `${end}T23:59:59.999Z`),
    }
  );

  const eventsByClient = new Map<string, AssignmentEventRow[]>();
  for (const row of assignmentEvents) {
    const cid = row.client_id as string;
    const list = eventsByClient.get(cid) ?? [];
    list.push({
      client_id: cid,
      es_user_id: row.es_user_id as string,
      effective_at: row.effective_at as string,
    });
    eventsByClient.set(cid, list);
  }

  const assigneesByClient = buildAssigneeIdsByClientFromEvents(eventsByClient, monthKey);
  const lastAssigneeByClient = buildLastAssigneeByClientFromEvents(eventsByClient, monthKey);

  const assigneeProfileIds = [
    ...new Set([...assigneesByClient.values()].flatMap((ids) => ids)),
  ];
  const assigneeProfiles =
    assigneeProfileIds.length > 0
      ? await fetchAllPostgrestRowsByIn<{
          id: string;
          role: string | null;
          is_active: boolean | null;
        }>(admin, "profiles", "id, role, is_active", "id", assigneeProfileIds, {
          order: { column: "id", ascending: true },
        })
      : [];
  const assigneeProfileById = new Map(
    assigneeProfiles.map((p) => [
      p.id,
      {
        role: p.role,
        isActive: p.is_active,
        isKraRoster:
          p.is_active !== false &&
          (KRA_ROSTER_ROLES as readonly string[]).includes((p.role ?? "").trim().toLowerCase()),
        isFormerStaff: isStaffRole(p.role) && p.is_active === false,
      },
    ])
  );

  const candidateClientIds = new Set<string>();
  for (const [clientId, assignees] of assigneesByClient) {
    if (assignees.some((id) => staffIdSet.has(id))) {
      candidateClientIds.add(clientId);
    }
  }

  const clientIds = [...candidateClientIds];
  const clientRows =
    clientIds.length > 0
      ? await fetchAllPostgrestRowsByIn<{
          id: string;
          current_service_id: string | null;
          full_name: string | null;
          contact_email: string | null;
          archived_at: string | null;
          intake_status: string | null;
          is_demo: boolean | null;
        }>(
          admin,
          "clients",
          "id, current_service_id, full_name, contact_email, archived_at, intake_status, is_demo",
          "id",
          clientIds,
          { order: { column: "id", ascending: true } }
        )
      : [];

  const eligibleClients = clientRows.filter((c) => {
    if (c.is_demo === true) return false;
    if ((c.intake_status as string | null)?.trim().toLowerCase() === "discarded") return false;
    const archived = c.archived_at as string | null;
    if (archived && archived.slice(0, 10) < start) return false;
    const sid = c.current_service_id as string | null;
    if (!sid || !inScopeServiceIds.has(sid)) return false;
    const threshold = thresholdHoursForService(settings, sid);
    if (threshold == null) return false;
    return true;
  });

  const eligibleIds = eligibleClients.map((c) => c.id as string);

  const timeRows =
    eligibleIds.length > 0
      ? await fetchAllPostgrestRowsByIn<TimeRow>(
          admin,
          "es_time_entries",
          "es_user_id, client_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )",
          "client_id",
          eligibleIds,
          {
            order: { column: "id", ascending: true },
            applyFilters: (query) =>
              query
                .gte("service_date", start)
                .lte("service_date", end)
                .neq("status", "rejected"),
          }
        )
      : [];

  const clientMonthMinutes = new Map<string, number>();
  const loggedByStaffClient = new Map<string, number>();
  const gvraByClient = new Map<string, number>();

  for (const raw of timeRows) {
    const row = raw as TimeRow;
    const clientId = row.client_id;
    if (!clientId) continue;
    const mins = billableMinutesForKraRow(row, settings);
    if (mins <= 0) continue;
    clientMonthMinutes.set(clientId, (clientMonthMinutes.get(clientId) ?? 0) + mins);
    const key = `${row.es_user_id}:${clientId}`;
    loggedByStaffClient.set(key, (loggedByStaffClient.get(key) ?? 0) + mins);
    if (isGvraMonthlyAllowanceEntry(row)) {
      gvraByClient.set(clientId, (gvraByClient.get(clientId) ?? 0) + mins);
    }
  }

  const staffClients = new Map<string, KraClientComplianceRow[]>();

  for (const client of eligibleClients) {
    const clientId = client.id as string;
    const serviceId = client.current_service_id as string | null;
    const thresholdHours = thresholdHoursForService(settings, serviceId) ?? 0;
    const thresholdMinutes = thresholdHours * 60;
    const totalMinutes = clientMonthMinutes.get(clientId) ?? 0;
    const clientName =
      nameByClientId.get(clientId) ??
      (client.full_name as string | null)?.trim() ??
      (client.contact_email as string | null) ??
      clientId;
    const lastAssignee = lastAssigneeByClient.get(clientId) ?? null;
    const assignees = assigneesByClient.get(clientId) ?? [];

    for (const staffId of assignees) {
      if (!staffIdSet.has(staffId)) continue;
      const selfMinutes = loggedByStaffClient.get(`${staffId}:${clientId}`) ?? 0;
      const othersMinutes = Math.max(0, totalMinutes - selfMinutes);
      const kraMinutes = settings.successor_inherits_client_month_hours
        ? totalMinutes
        : selfMinutes;

      const row: KraClientComplianceRow = {
        clientId,
        clientName,
        serviceId,
        thresholdHours,
        kraBillableMinutes: kraMinutes,
        kraBillableHours: formatBillableHours(kraMinutes),
        loggedBySelfMinutes: selfMinutes,
        loggedByOthersMinutes: othersMinutes,
        gvraAllowanceMinutes: gvraByClient.get(clientId) ?? 0,
        met: kraMinutes >= thresholdMinutes,
        lastAssigneeInMonthUserId: lastAssignee,
      };
      const list = staffClients.get(staffId) ?? [];
      list.push(row);
      staffClients.set(staffId, list);
    }
  }

  // Supervisors only appear when they have in-scope clients this month; ES/TS always listed.
  const displayStaffIds = liveStaffIds.filter((id) => {
    const role = staffMeta.get(id)?.role;
    if (role === "supervisor") {
      return (staffClients.get(id) ?? []).length > 0;
    }
    return true;
  });

  const rows: KraStaffComplianceRow[] = displayStaffIds.map((staffUserId) => {
    const clients = staffClients.get(staffUserId) ?? [];
    const metCount = clients.filter((c) => c.met).length;
    const inScopeClientCount = clients.length;
    const missedCount = inScopeClientCount - metCount;
    const totalKraMinutes = clients.reduce((s, c) => s + c.kraBillableMinutes, 0);
    const avgMinutes = inScopeClientCount > 0 ? totalKraMinutes / inScopeClientCount : 0;
    const expectedBillableMinutes = expectedBillableMinutesForClients(clients);
    return {
      staffUserId,
      staffName: nameByStaffId.get(staffUserId) ?? "Team member",
      role: staffMeta.get(staffUserId)?.role ?? null,
      inScopeClientCount,
      metCount,
      missedCount,
      complianceLabel: `${metCount} / ${inScopeClientCount}`,
      averageBillableHoursPerClient: formatBillableHours(avgMinutes),
      expectedBillableMinutes,
      expectedBillableHours: formatExpectedBillableHours(expectedBillableMinutes),
      clients: clients.sort((a, b) => a.clientName.localeCompare(b.clientName)),
    };
  });

  rows.sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" }));

  const uncounted = await buildUncountedForMonth(admin, {
    start,
    end,
    settings,
    inScopeServiceIds,
    assigneesByClient,
    assigneeProfileById,
    staffIdSet,
  });

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    range: { start, end },
    frozen: false,
    closedAt: null,
    settings: {
      count_system_allowance_toward_kra: settings.count_system_allowance_toward_kra,
      successor_inherits_client_month_hours: settings.successor_inherits_client_month_hours,
    },
    rows,
    uncounted,
  };
}

async function buildUncountedForMonth(
  admin: SupabaseClient,
  opts: {
    start: string;
    end: string;
    settings: KraBillableSettingsRow;
    inScopeServiceIds: Set<string>;
    assigneesByClient: Map<string, string[]>;
    assigneeProfileById: Map<
      string,
      {
        role: string | null;
        isActive: boolean | null;
        isKraRoster: boolean;
        isFormerStaff: boolean;
      }
    >;
    staffIdSet: Set<string>;
  }
): Promise<KraUncountedHoursBreakdown> {
  type PayrollEntry = TimeRow & {
    clients:
      | { is_demo: boolean | null; current_service_id: string | null }
      | { is_demo: boolean | null; current_service_id: string | null }[]
      | null;
  };

  const payrollEntries = await fetchAllPostgrestRows<PayrollEntry>(
    admin,
    "es_time_entries",
    "es_user_id, client_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable ), clients ( is_demo, current_service_id )",
    {
      order: { column: "id", ascending: true },
      applyFilters: (query) =>
        query
          .gte("service_date", opts.start)
          .lte("service_date", opts.end)
          .neq("status", "rejected"),
    }
  );

  const classifications = [];
  for (const raw of payrollEntries) {
    const embed = raw.clients;
    const client = Array.isArray(embed) ? embed[0] : embed;
    if (client?.is_demo === true) continue;

    const mins = billableMinutesForKraRow(raw, opts.settings);
    if (mins <= 0) continue;

    const clientId = raw.client_id;
    const serviceId = client?.current_service_id ?? null;
    const clientInKraScope = Boolean(
      clientId && serviceId && opts.inScopeServiceIds.has(serviceId)
    );

    const assignees = clientId ? opts.assigneesByClient.get(clientId) ?? [] : [];
    const hasKraRosterAssignee = assignees.some((id) => opts.staffIdSet.has(id));
    const hasOnlyFormerStaffAssignees =
      assignees.length > 0 &&
      !hasKraRosterAssignee &&
      assignees.every((id) => opts.assigneeProfileById.get(id)?.isFormerStaff === true);

    classifications.push(
      classifyPayrollEntryForKra({
        billableMinutes: mins,
        clientId,
        clientInKraScope,
        hasKraRosterAssignee,
        hasOnlyFormerStaffAssignees,
      })
    );
  }

  return buildKraUncountedHoursBreakdown(classifications);
}

function emptyRollup(
  monthKey: string,
  start: string,
  end: string,
  settings: KraBillableSettingsRow,
  staffIds: string[],
  nameByStaffId: Map<string, string>,
  staffMeta: Map<string, { role: string | null }>
): KraBillableComplianceRollup {
  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    range: { start, end },
    frozen: false,
    closedAt: null,
    settings: {
      count_system_allowance_toward_kra: settings.count_system_allowance_toward_kra,
      successor_inherits_client_month_hours: settings.successor_inherits_client_month_hours,
    },
    rows: staffIds
      .filter((id) => staffMeta.get(id)?.role !== "supervisor")
      .map((id) => ({
        staffUserId: id,
        staffName: nameByStaffId.get(id) ?? "Team member",
        role: staffMeta.get(id)?.role ?? null,
        inScopeClientCount: 0,
        metCount: 0,
        missedCount: 0,
        complianceLabel: "0 / 0",
        averageBillableHoursPerClient: "0.0",
        expectedBillableMinutes: 0,
        expectedBillableHours: "0.0",
        clients: [],
      })),
    uncounted: emptyUncounted(),
  };
}
