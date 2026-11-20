import type { SupabaseClient } from "@supabase/supabase-js";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";
import { loadActivityTypeByCode } from "./es-time-tracking";
import { isStaffRole } from "./roles";
import { isMissingSchemaError } from "./schema-fallback";

const GVRA_ALLOWANCE_ACTIVITY_CODE = "JT-CSE-051";
const ALLOWANCE_MINUTES = 120;

const GVRA_MONTHLY_SERVICE_NAMES = new Set([
  "Individual Job Placement",
  "Individual Job Placement (GA)",
  "Traditional Supported Employment",
  "Traditional Supported Employment (GA)",
]);

/** GVRA monthly allowance may only credit staff-role assignees. */
export function assigneeIsEligibleForGvraAllowance(
  role: string | null | undefined
): boolean {
  return isStaffRole(role);
}

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

export type GvraEligibleClient = {
  id: string;
  es_user_id: string;
};

export type GvraSkippedNonStaffClient = {
  clientId: string;
  assigneeUserId: string;
  assigneeRole: string | null;
};

async function loadEligibleClients(
  admin: SupabaseClient,
  serviceNames: string[]
): Promise<{
  eligible: GvraEligibleClient[];
  skippedNonStaff: GvraSkippedNonStaffClient[];
}> {
  const { data: services } = await admin
    .from("services")
    .select("id, name")
    .in("name", serviceNames);
  const serviceIds = (services ?? []).map((s) => s.id as string);
  if (serviceIds.length === 0) return { eligible: [], skippedNonStaff: [] };

  const { data: clients, error } = await admin
    .from("clients")
    .select("id, current_service_id, archived_at, intake_status, is_demo")
    .in("current_service_id", serviceIds)
    .is("archived_at", null)
    .neq("intake_status", "discarded");

  if (error) {
    console.error("gvra allowance client load failed:", error.message);
    return { eligible: [], skippedNonStaff: [] };
  }

  const eligible: GvraEligibleClient[] = [];
  const skippedNonStaff: GvraSkippedNonStaffClient[] = [];

  for (const row of clients ?? []) {
    if (row.is_demo === true) continue;
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

    const { data: assigneeProfile } = await admin
      .from("profiles")
      .select("id, role")
      .eq("id", esUserId)
      .maybeSingle();
    const assigneeRole = (assigneeProfile?.role as string | null) ?? null;
    if (!assigneeIsEligibleForGvraAllowance(assigneeRole)) {
      console.warn(
        `gvra allowance: skipping client ${clientId} — assignee ${esUserId} has non-staff role ${assigneeRole ?? "(null)"} (needs review)`
      );
      skippedNonStaff.push({
        clientId,
        assigneeUserId: esUserId,
        assigneeRole,
      });
      continue;
    }

    eligible.push({ id: clientId, es_user_id: esUserId });
  }
  return { eligible, skippedNonStaff };
}

/**
 * Grant 2.0 billable hours per IJP/TSE client for a calendar month (Eastern).
 * Idempotent per client + month. Excluded from Active (in-person) ratio via flags.
 */
export type GvraAllowanceGrantResult = {
  granted: number;
  skipped: number;
  skippedNonStaff: number;
  skippedNonStaffClients: GvraSkippedNonStaffClient[];
};

export async function grantGvraMonthlyAllowancesForMonth(
  admin: SupabaseClient,
  opts?: { monthStart?: string; now?: Date }
): Promise<GvraAllowanceGrantResult> {
  const now = opts?.now ?? new Date();
  const monthStart = opts?.monthStart ?? monthStartYmdFromDate(now);
  const serviceDate = lastDayOfMonthYmd(monthStart);

  let activity = await loadActivityTypeByCode(admin, GVRA_ALLOWANCE_ACTIVITY_CODE);
  if (!activity) {
    activity = await loadActivityTypeByCode(admin, "JT-ACT-040");
  }
  if (!activity?.id) {
    console.error("gvra allowance: no activity type for system entries");
    return { granted: 0, skipped: 0, skippedNonStaff: 0, skippedNonStaffClients: [] };
  }

  const { eligible: clients, skippedNonStaff: skippedNonStaffClients } =
    await loadEligibleClients(admin, [...GVRA_MONTHLY_SERVICE_NAMES]);
  let granted = 0;
  let skipped = skippedNonStaffClients.length;

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

  return {
    granted,
    skipped,
    skippedNonStaff: skippedNonStaffClients.length,
    skippedNonStaffClients,
  };
}

/** Run for the month that just ended (typical cron on 1st of month). */
export async function grantGvraMonthlyAllowancesForPriorMonth(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<GvraAllowanceGrantResult & { monthStart: string }> {
  const todayYmd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m] = todayYmd.split("-").map(Number);
  const prior = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
  const monthStart = monthStartYmdFromDate(prior);
  const result = await grantGvraMonthlyAllowancesForMonth(admin, { monthStart, now });
  return { ...result, monthStart };
}
