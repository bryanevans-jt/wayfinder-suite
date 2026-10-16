import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";
import { loadActivityTypeByCode } from "./es-time-tracking";
import { isMissingSchemaError } from "./schema-fallback";

const GVRA_ALLOWANCE_ACTIVITY_CODE = "JT-CSE-051";
const ALLOWANCE_MINUTES = 120;

const GVRA_MONTHLY_SERVICE_NAMES = new Set([
  "Individual Job Placement (GA)",
  "Traditional Supported Employment (GA)",
]);

function monthStartYmdFromDate(d: Date): string {
  const ymd = localDateStringInTz(d, STAFF_CLOCK_TIMEZONE);
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

function lastDayOfMonthYmd(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

async function loadEligibleClients(
  admin: SupabaseClient,
  serviceNames: string[]
): Promise<Array<{ id: string; es_user_id: string | null }>> {
  const { data: services } = await admin
    .from("services")
    .select("id, name")
    .in("name", serviceNames);
  const serviceIds = (services ?? []).map((s) => s.id as string);
  if (serviceIds.length === 0) return [];

  const { data: clients, error } = await admin
    .from("clients")
    .select("id, current_service_id, archived_at, intake_status")
    .in("current_service_id", serviceIds)
    .is("archived_at", null)
    .neq("intake_status", "discarded");

  if (error) {
    console.error("gvra allowance client load failed:", error.message);
    return [];
  }

  const out: Array<{ id: string; es_user_id: string | null }> = [];
  for (const row of clients ?? []) {
    const clientId = row.id as string;
    const { data: assignment } = await admin
      .from("es_client_assignments")
      .select("es_user_id")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const esUserId = (assignment?.es_user_id as string | null) ?? null;
    if (!esUserId) continue;
    out.push({ id: clientId, es_user_id: esUserId });
  }
  return out;
}

/**
 * Grant 2.0 billable hours per IJP/TSE (GA) client for a calendar month (Eastern).
 * Idempotent per client + month. Excluded from Active (in-person) ratio via flags.
 */
export async function grantGvraMonthlyAllowancesForMonth(
  admin: SupabaseClient,
  opts?: { monthStart?: string; now?: Date }
): Promise<{ granted: number; skipped: number }> {
  const now = opts?.now ?? new Date();
  const monthStart = opts?.monthStart ?? monthStartYmdFromDate(now);
  const serviceDate = lastDayOfMonthYmd(monthStart);

  let activity = await loadActivityTypeByCode(admin, GVRA_ALLOWANCE_ACTIVITY_CODE);
  if (!activity) {
    activity = await loadActivityTypeByCode(admin, "JT-ACT-040");
  }
  if (!activity?.id) {
    console.error("gvra allowance: no activity type for system entries");
    return { granted: 0, skipped: 0 };
  }

  const clients = await loadEligibleClients(admin, [...GVRA_MONTHLY_SERVICE_NAMES]);
  let granted = 0;
  let skipped = 0;

  for (const client of clients) {
    const { data: existingGrant } = await admin
      .from("gvra_monthly_allowance_grants")
      .select("id")
      .eq("client_id", client.id)
      .eq("service_month", monthStart)
      .maybeSingle();

    if (existingGrant?.id) {
      skipped += 1;
      continue;
    }

    const narrative =
      "GVRA monthly report and paperwork allowance (2.0 billable hours — system)";
    const flags = { gvra_monthly_admin_allowance: true, system_generated: true };

    const insertRow = {
      es_user_id: client.es_user_id,
      client_id: client.id,
      activity_type_id: activity.id,
      service_date: serviceDate,
      duration_minutes: ALLOWANCE_MINUTES,
      narrative,
      linked_source_type: "manual" as const,
      flags,
      status: "approved" as const,
      approved_at: new Date().toISOString(),
      client_present: false,
      delivery_mode: null,
    };

    let entryId: string | null = null;
    const { data: inserted, error: insertErr } = await admin
      .from("es_time_entries")
      .insert(insertRow)
      .select("id")
      .maybeSingle();

    if (insertErr) {
      if (isMissingSchemaError(insertErr.message)) {
        const { data: legacy } = await admin
          .from("es_time_entries")
          .insert({
            es_user_id: client.es_user_id,
            client_id: client.id,
            activity_type_id: activity.id,
            service_date: serviceDate,
            duration_minutes: ALLOWANCE_MINUTES,
            narrative,
            linked_source_type: "manual",
            flags,
            status: "approved",
            approved_at: new Date().toISOString(),
          })
          .select("id")
          .maybeSingle();
        entryId = (legacy?.id as string) ?? null;
      } else {
        console.error("gvra allowance insert failed:", insertErr.message);
        skipped += 1;
        continue;
      }
    } else {
      entryId = (inserted?.id as string) ?? null;
    }

    const { error: grantErr } = await admin.from("gvra_monthly_allowance_grants").insert({
      client_id: client.id,
      service_month: monthStart,
      es_time_entry_id: entryId,
      minutes: ALLOWANCE_MINUTES,
    });

    if (grantErr) {
      console.error("gvra allowance grant ledger failed:", grantErr.message);
      skipped += 1;
      continue;
    }

    granted += 1;
  }

  return { granted, skipped };
}

/** Run for the month that just ended (typical cron on 1st of month). */
export async function grantGvraMonthlyAllowancesForPriorMonth(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ granted: number; skipped: number; monthStart: string }> {
  const todayYmd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m] = todayYmd.split("-").map(Number);
  const prior = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
  const monthStart = monthStartYmdFromDate(prior);
  const result = await grantGvraMonthlyAllowancesForMonth(admin, { monthStart, now });
  return { ...result, monthStart };
}
