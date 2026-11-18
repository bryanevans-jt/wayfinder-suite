/**
 * Client-safe timesheet helpers/types. Keep free of server-only modules
 * (admin client, next/headers) so "use client" components can import here.
 */
import {
  entryCountsTowardClientBillable,
  sumClientBillableMinutes,
} from "@wayfinder/supabase/client-billable";
import {
  parseLocalDate,
  weekStartSunday,
  workedMinutesFromEntries,
} from "@wayfinder/supabase/es-time-tracking";

export type EsTimeEntryRow = {
  id: string;
  es_user_id: string;
  client_id: string | null;
  client_name: string | null;
  activity_type_id: string;
  activity_code: string;
  activity_name: string;
  activity_category: string;
  counts_toward_client_billable: boolean;
  service_date: string;
  duration_minutes: number;
  duration_hours: string;
  client_billable_hours: string;
  service_start_at: string | null;
  service_end_at: string | null;
  created_at: string | null;
  narrative: string | null;
  linked_source_type: string | null;
  status: string;
  flags: Record<string, boolean>;
  client_present?: boolean | null;
  delivery_mode?: string | null;
  service_episode_id?: string | null;
  service_id?: string | null;
  service_name?: string | null;
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

export type SupervisedEsOption = { id: string; name: string };

export type TimesheetClientOption = { id: string; name: string };

export type ClientServiceBillableGroup = {
  key: string;
  clientId: string | null;
  clientName: string;
  serviceId: string | null;
  serviceName: string;
  billableMinutes: number;
  /** All entries for this client+service (billable and non-billable). */
  entryCount: number;
  entries: EsTimeEntryRow[];
};

export function summarizeTimeEntries(entries: EsTimeEntryRow[]) {
  const byClient = new Map<
    string,
    { clientId: string | null; name: string; minutes: number; count: number }
  >();
  const byActivity = new Map<string, { name: string; minutes: number; count: number }>();
  const clientBillableEntries = entries.map((e) => ({
    duration_minutes: e.duration_minutes,
    counts_toward_client_billable: e.counts_toward_client_billable,
    flags: e.flags ?? {},
  }));
  const clientBillableMinutes = sumClientBillableMinutes(clientBillableEntries);
  /** Same rules as My Billable Hours — activity exceptions only; client present does not matter. */
  const billableMinutes = clientBillableMinutes;
  const workedMinutes = workedMinutesFromEntries(entries);

  for (const e of entries) {
    const clientKey = e.client_id ?? "non-client";
    const clientName = e.client_id
      ? (e.client_name ?? "Unknown client")
      : "Non-client time";
    const clientRow = byClient.get(clientKey) ?? {
      clientId: e.client_id,
      name: clientName,
      minutes: 0,
      count: 0,
    };
    if (entryCountsTowardClientBillable({ duration_minutes: e.duration_minutes, counts_toward_client_billable: e.counts_toward_client_billable })) {
      clientRow.minutes += e.duration_minutes;
    }
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
    /** Per-client billable totals (excludes Case File Review, etc.). */
    clientBillableMinutes,
    workedMinutes,
    byClient: [...byClient.values()].sort((a, b) => b.minutes - a.minutes),
    byActivity: [...byActivity.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

/**
 * Group entries by client + service for the monthly billable hours ledger.
 * Billable minutes exclude Case File Review / note-only; entry counts include all logs.
 */
export function summarizeTimeEntriesByClientService(
  entries: EsTimeEntryRow[]
): ClientServiceBillableGroup[] {
  const groups = new Map<string, ClientServiceBillableGroup>();

  for (const e of entries) {
    const clientId = e.client_id;
    const clientName = clientId
      ? (e.client_name ?? "Unknown client")
      : "Non-client time";
    const serviceId = e.service_id ?? null;
    const serviceName = e.service_name?.trim() || "Unassigned service";
    const key = `${clientId ?? "non-client"}::${serviceId ?? "none"}::${serviceName}`;
    const group = groups.get(key) ?? {
      key,
      clientId,
      clientName,
      serviceId,
      serviceName,
      billableMinutes: 0,
      entryCount: 0,
      entries: [],
    };
    if (
      entryCountsTowardClientBillable({
        duration_minutes: e.duration_minutes,
        counts_toward_client_billable: e.counts_toward_client_billable,
      })
    ) {
      group.billableMinutes += e.duration_minutes;
    }
    group.entryCount += 1;
    group.entries.push(e);
    groups.set(key, group);
  }

  return [...groups.values()].sort((a, b) => {
    const byName = a.clientName.localeCompare(b.clientName, undefined, {
      sensitivity: "base",
    });
    if (byName !== 0) return byName;
    return a.serviceName.localeCompare(b.serviceName, undefined, {
      sensitivity: "base",
    });
  });
}

export function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekStartSunday(d);
}

/** Shift a YYYY-MM month key by whole months. */
export function shiftMonthKey(monthKey: string, deltaMonths: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1, 12, 0, 0));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
}
