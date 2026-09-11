import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  contactLogDisplayText,
  fetchContactLogsWithSchemaFallback,
} from "@wayfinder/supabase/contact-logs-query";
import {
  filterClientContactActivityTypes,
  formatTimeInputValue,
  loadActiveActivityTypes,
  type ServiceActivityType,
} from "@wayfinder/supabase/es-time-tracking";
import { isMissingSchemaError } from "@wayfinder/supabase/schema-fallback";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type ContactLogTimeEntrySnapshot = {
  id: string;
  activityTypeId: string;
  serviceDate: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  linked: boolean;
};

export type ContactLogTimeEditPayload = {
  contactLogId: string;
  clientId: string;
  summary: string;
  timeEntry: ContactLogTimeEntrySnapshot | null;
  activities: ServiceActivityType[];
};

const TIME_ENTRY_SELECT_SHAPES = [
  "id, activity_type_id, service_date, duration_minutes, service_start_at, service_end_at, created_at",
  "id, activity_type_id, service_date, duration_minutes, created_at",
] as const;

type RawTimeRow = {
  id: string;
  activity_type_id: string;
  service_date: string;
  duration_minutes: number | null;
  service_start_at?: string | null;
  service_end_at?: string | null;
  created_at: string;
};

function timeOfDayFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatTimeInputValue(new Date(iso));
}

function snapshotFromRow(row: RawTimeRow, linked: boolean): ContactLogTimeEntrySnapshot {
  return {
    id: row.id,
    activityTypeId: row.activity_type_id,
    serviceDate: row.service_date.slice(0, 10),
    durationMinutes: Number(row.duration_minutes ?? 0),
    startTime: timeOfDayFromIso(row.service_start_at),
    endTime: timeOfDayFromIso(row.service_end_at),
    linked,
  };
}

async function loadContactLogRow(
  admin: AdminClient,
  contactLogId: string
): Promise<Record<string, unknown> | null> {
  const rows = await fetchContactLogsWithSchemaFallback(async (cols) => {
    const result = await admin
      .from("contact_logs")
      .select(cols)
      .eq("id", contactLogId)
      .maybeSingle();
    return {
      data: result.data ? [result.data as unknown as Record<string, unknown>] : null,
      error: result.error,
    };
  });
  return rows[0] ?? null;
}

async function loadLinkedTimeEntry(
  admin: AdminClient,
  contactLogId: string
): Promise<ContactLogTimeEntrySnapshot | null> {
  let lastError: string | null = null;
  for (const cols of TIME_ENTRY_SELECT_SHAPES) {
    const { data, error } = await admin
      .from("es_time_entries")
      .select(cols)
      .eq("linked_source_type", "contact_log")
      .eq("linked_source_id", contactLogId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!error) {
      const row = (data?.[0] as unknown as RawTimeRow | undefined) ?? null;
      return row ? snapshotFromRow(row, true) : null;
    }

    lastError = error.message;
    if (isMissingSchemaError(error.message)) {
      continue;
    }
    throw new Error(error.message);
  }

  throw new Error(lastError ?? "Could not load linked service time");
}

function contactLogServiceDate(createdAt: string): string {
  return createdAt.slice(0, 10);
}

/** Best-effort match when the time row was saved without contact_log linkage. */
async function loadHeuristicTimeEntry(
  admin: AdminClient,
  contactLog: Record<string, unknown>
): Promise<ContactLogTimeEntrySnapshot | null> {
  const clientId = contactLog.client_id as string | undefined;
  const loggedBy = contactLog.logged_by as string | undefined;
  const createdAt = contactLog.created_at as string | undefined;
  if (!clientId || !loggedBy || !createdAt) {
    return null;
  }

  const serviceDate = contactLogServiceDate(createdAt);
  let lastError: string | null = null;
  for (const cols of TIME_ENTRY_SELECT_SHAPES) {
    const { data, error } = await admin
      .from("es_time_entries")
      .select(cols)
      .eq("client_id", clientId)
      .eq("es_user_id", loggedBy)
      .eq("service_date", serviceDate)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      lastError = error.message;
      if (isMissingSchemaError(error.message)) {
        continue;
      }
      throw new Error(error.message);
    }

    const rows = (data ?? []) as unknown as RawTimeRow[];
    if (rows.length === 0) {
      return null;
    }

    const contactMs = Date.parse(createdAt);
    const scored = rows
      .map((row) => ({
        row,
        deltaMs: Math.abs(Date.parse(row.created_at) - contactMs),
      }))
      .sort((a, b) => a.deltaMs - b.deltaMs);

    const best = scored[0];
    if (!best || best.deltaMs > 2 * 60 * 60 * 1000) {
      return null;
    }

    return snapshotFromRow(best.row, false);
  }

  throw new Error(lastError ?? "Could not load service time");
}

export async function loadContactLogTimeEditPayload(
  admin: AdminClient,
  contactLogId: string
): Promise<ContactLogTimeEditPayload | null> {
  const contactLog = await loadContactLogRow(admin, contactLogId);
  if (!contactLog) {
    return null;
  }

  const linkedEntry = await loadLinkedTimeEntry(admin, contactLogId);
  const timeEntry =
    linkedEntry ?? (await loadHeuristicTimeEntry(admin, contactLog));
  const activities = filterClientContactActivityTypes(await loadActiveActivityTypes(admin));

  const summary =
    contactLogDisplayText({
      public_outcome: contactLog.public_outcome as string | null | undefined,
      notes: contactLog.notes as string | null | undefined,
      outcome: contactLog.outcome as string | null | undefined,
    }) || "Contact log";

  return {
    contactLogId,
    clientId: contactLog.client_id as string,
    summary,
    activities,
    timeEntry,
  };
}

export async function loadLinkedTimeEntrySnapshot(
  admin: AdminClient,
  contactLogId: string
): Promise<ContactLogTimeEntrySnapshot | null> {
  const payload = await loadContactLogTimeEditPayload(admin, contactLogId);
  return payload?.timeEntry ?? null;
}
