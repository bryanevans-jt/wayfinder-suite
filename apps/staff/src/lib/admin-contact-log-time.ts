import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  filterClientContactActivityTypes,
  formatTimeInputValue,
  loadActiveActivityTypes,
  type ServiceActivityType,
} from "@wayfinder/supabase/es-time-tracking";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type ContactLogTimeEntrySnapshot = {
  id: string;
  activityTypeId: string;
  serviceDate: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
};

export type ContactLogTimeEditPayload = {
  contactLogId: string;
  clientId: string;
  summary: string;
  timeEntry: ContactLogTimeEntrySnapshot | null;
  activities: ServiceActivityType[];
};

function timeOfDayFromIso(iso: string | null | undefined): string {
  if (!iso) return "";
  return formatTimeInputValue(new Date(iso));
}

export async function loadContactLogTimeEditPayload(
  admin: AdminClient,
  contactLogId: string
): Promise<ContactLogTimeEditPayload | null> {
  const { data: contactLog, error: logErr } = await admin
    .from("contact_logs")
    .select("id, client_id, public_outcome, notes, outcome")
    .eq("id", contactLogId)
    .maybeSingle();

  if (logErr) {
    throw new Error(logErr.message);
  }
  if (!contactLog) {
    return null;
  }

  const { data: timeRows, error: timeErr } = await admin
    .from("es_time_entries")
    .select(
      "id, activity_type_id, service_date, duration_minutes, service_start_at, service_end_at, created_at"
    )
    .eq("linked_source_type", "contact_log")
    .eq("linked_source_id", contactLogId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (timeErr) {
    throw new Error(timeErr.message);
  }

  const timeRow = timeRows?.[0] ?? null;
  const activities = filterClientContactActivityTypes(await loadActiveActivityTypes(admin));

  const summary =
    (contactLog.public_outcome as string | null)?.trim() ||
    (contactLog.outcome as string | null)?.trim() ||
    "Contact log";

  return {
    contactLogId,
    clientId: contactLog.client_id as string,
    summary,
    activities,
    timeEntry: timeRow
      ? {
          id: timeRow.id as string,
          activityTypeId: timeRow.activity_type_id as string,
          serviceDate: (timeRow.service_date as string).slice(0, 10),
          durationMinutes: Number(timeRow.duration_minutes ?? 0),
          startTime: timeOfDayFromIso(timeRow.service_start_at as string | null),
          endTime: timeOfDayFromIso(timeRow.service_end_at as string | null),
        }
      : null,
  };
}

export async function loadLinkedTimeEntrySnapshot(
  admin: AdminClient,
  contactLogId: string
): Promise<ContactLogTimeEntrySnapshot | null> {
  const payload = await loadContactLogTimeEditPayload(admin, contactLogId);
  return payload?.timeEntry ?? null;
}
