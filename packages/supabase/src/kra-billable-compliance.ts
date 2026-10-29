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
  loadKraBillableSettings,
  serviceIdsInKraScope,
  thresholdHoursForService,
  type KraBillableSettingsRow,
} from "./kra-billable-settings";

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
  inScopeClientCount: number;
  metCount: number;
  missedCount: number;
  complianceLabel: string;
  averageBillableHoursPerClient: string;
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
  client_id: string;
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

  const fieldRoles = ["es", "transition_specialist"] as const;
  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id, role, is_active")
    .in("role", [...fieldRoles])
    .neq("is_active", false);

  const staffIds = (staffProfiles ?? []).map((p) => p.id as string);
  const staffIdSet = new Set(staffIds);

  if (inScopeServiceIds.size === 0) {
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
      rows: staffIds.map((id) => ({
        staffUserId: id,
        staffName: nameByStaffId.get(id) ?? "Team member",
        inScopeClientCount: 0,
        metCount: 0,
        missedCount: 0,
        complianceLabel: "0 / 0",
        averageBillableHoursPerClient: "0.0",
        clients: [],
      })),
    };
  }

  const { data: assignmentEvents } = await admin
    .from("es_client_assignment_events")
    .select("client_id, es_user_id, effective_at")
    .lte("effective_at", `${end}T23:59:59.999Z`);

  const eventsByClient = new Map<string, AssignmentEventRow[]>();
  for (const row of assignmentEvents ?? []) {
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

  const candidateClientIds = new Set<string>();
  for (const [clientId, assignees] of assigneesByClient) {
    if (assignees.some((id) => staffIdSet.has(id))) {
      candidateClientIds.add(clientId);
    }
  }

  const clientIds = [...candidateClientIds];
  if (clientIds.length === 0) {
    return emptyRollup(monthKey, start, end, settings, staffIds, nameByStaffId);
  }

  const { data: clientRows } = await admin
    .from("clients")
    .select("id, current_service_id, full_name, contact_email, archived_at, intake_status, is_demo")
    .in("id", clientIds);

  const eligibleClients = (clientRows ?? []).filter((c) => {
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
  if (eligibleIds.length === 0) {
    return emptyRollup(monthKey, start, end, settings, staffIds, nameByStaffId);
  }

  const { data: timeRows, error: timeErr } = await admin
    .from("es_time_entries")
    .select(
      "es_user_id, client_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )"
    )
    .in("client_id", eligibleIds)
    .gte("service_date", start)
    .lte("service_date", end)
    .neq("status", "rejected");

  if (timeErr) {
    throw new Error(timeErr.message);
  }

  const clientMonthMinutes = new Map<string, number>();
  const loggedByStaffClient = new Map<string, number>();
  const gvraByClient = new Map<string, number>();

  for (const raw of timeRows ?? []) {
    const row = raw as unknown as TimeRow;
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

  const rows: KraStaffComplianceRow[] = staffIds.map((staffUserId) => {
    const clients = staffClients.get(staffUserId) ?? [];
    const metCount = clients.filter((c) => c.met).length;
    const inScopeClientCount = clients.length;
    const missedCount = inScopeClientCount - metCount;
    const totalKraMinutes = clients.reduce((s, c) => s + c.kraBillableMinutes, 0);
    const avgMinutes =
      inScopeClientCount > 0 ? totalKraMinutes / inScopeClientCount : 0;
    return {
      staffUserId,
      staffName: nameByStaffId.get(staffUserId) ?? "Team member",
      inScopeClientCount,
      metCount,
      missedCount,
      complianceLabel: `${metCount} / ${inScopeClientCount}`,
      averageBillableHoursPerClient: formatBillableHours(avgMinutes),
      clients: clients.sort((a, b) => a.clientName.localeCompare(b.clientName)),
    };
  });

  rows.sort((a, b) => a.staffName.localeCompare(b.staffName, undefined, { sensitivity: "base" }));

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
  };
}

function emptyRollup(
  monthKey: string,
  start: string,
  end: string,
  settings: KraBillableSettingsRow,
  staffIds: string[],
  nameByStaffId: Map<string, string>
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
    rows: staffIds.map((id) => ({
      staffUserId: id,
      staffName: nameByStaffId.get(id) ?? "Team member",
      inScopeClientCount: 0,
      metCount: 0,
      missedCount: 0,
      complianceLabel: "0 / 0",
      averageBillableHoursPerClient: "0.0",
      clients: [],
    })),
  };
}
