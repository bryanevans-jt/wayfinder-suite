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

export function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekStartSunday(d);
}
