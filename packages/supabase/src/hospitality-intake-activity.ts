import type { SupabaseClient } from "@supabase/supabase-js";

/** Meeting-shaped rows for `buildClientActivityFeed` (Intake appointments). */
export type IntakeAppointmentMeetingRow = {
  id: string;
  created_at: string;
  status: string;
  starts_at: string;
  location: string;
  timezone: string;
  service_name: string;
  es_name: string | null;
};

/**
 * Load scheduled hospitality intake appointments for activity timelines
 * (client, counselor, ES). Uses service-role admin (table is not client-RLS).
 */
export async function loadIntakeAppointmentsAsMeetings(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<IntakeAppointmentMeetingRow[]> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const { data, error } = await admin
    .from("hospitality_intake_tasks")
    .select(
      "id, appointment_starts_at, appointment_location, appointment_timezone, completed_at, status"
    )
    .in("client_id", ids)
    .not("appointment_starts_at", "is", null);

  if (error) {
    console.error("[intake-activity] load failed:", error.message);
    return [];
  }

  const rows: IntakeAppointmentMeetingRow[] = [];
  for (const row of data ?? []) {
    const startsAt = row.appointment_starts_at as string | null;
    if (!startsAt) continue;
    const location = String(row.appointment_location ?? "").trim() || "Location to be confirmed";
    const timezone =
      String(row.appointment_timezone ?? "").trim() || "America/New_York";
    rows.push({
      id: `intake-${row.id as string}`,
      created_at: (row.completed_at as string | null) ?? startsAt,
      status: "accepted",
      starts_at: startsAt,
      location,
      timezone,
      service_name: "Intake",
      es_name: "Hospitality Specialist",
    });
  }
  return rows;
}
