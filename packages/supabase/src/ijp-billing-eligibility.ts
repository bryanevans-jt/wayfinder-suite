import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  type ClientBillableEntry,
} from "./client-billable";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";
import { resolveGaIjpServiceId } from "./ijp-billing-settings";
import { isIndividualJobPlacementServiceName } from "./ijp-stages";

export function serviceMonthStartFromYmd(ymd: string): string {
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

export function serviceMonthEndYmd(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  return `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, "0")}-${String(last.getUTCDate()).padStart(2, "0")}`;
}

export function priorServiceMonthStart(now = new Date()): string {
  const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m] = ymd.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1, 12, 0, 0));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function currentServiceMonthStart(now = new Date()): string {
  const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m] = ymd.split("-");
  return `${y}-${m}-01`;
}

function monthRangeUtc(monthStart: string): { start: string; end: string } {
  const endYmd = serviceMonthEndYmd(monthStart);
  return {
    start: `${monthStart}T00:00:00.000Z`,
    end: `${endYmd}T23:59:59.999Z`,
  };
}

/** Client on GA IJP at least one day in the calendar month (episode overlap). */
export async function clientOnGaIjpDuringMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string,
  gaIjpServiceId: string
): Promise<boolean> {
  const monthEnd = serviceMonthEndYmd(monthStart);
  const { data: episodes } = await admin
    .from("service_episodes")
    .select("service_id, started_at, ended_at, status")
    .eq("client_id", clientId);

  for (const ep of episodes ?? []) {
    if ((ep.service_id as string) !== gaIjpServiceId) continue;
    const start = (ep.started_at as string)?.slice(0, 10) ?? "";
    const end = (ep.ended_at as string)?.slice(0, 10) ?? monthEnd;
    if (start <= monthEnd && end >= monthStart) {
      return true;
    }
  }

  const { data: client } = await admin
    .from("clients")
    .select("current_service_id, archived_at, is_demo, intake_status")
    .eq("id", clientId)
    .maybeSingle();

  if (!client || client.is_demo) return false;
  if ((client.current_service_id as string) === gaIjpServiceId) {
    const archived = client.archived_at as string | null;
    if (archived && archived.slice(0, 10) < monthStart) return false;
    return true;
  }

  const { data: svc } = await admin
    .from("services")
    .select("name, state")
    .eq("id", client.current_service_id)
    .maybeSingle();
  if (
    svc &&
    (svc.state as string) === "GA" &&
    isIndividualJobPlacementServiceName(svc.name as string)
  ) {
    return true;
  }

  return false;
}

export async function clientHasBillableTimeInMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string
): Promise<boolean> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const { data: rows } = await admin
    .from("es_time_entries")
    .select(
      "duration_minutes, flags, client_present, delivery_mode, service_date, status, service_activity_types ( code, counts_toward_client_billable )"
    )
    .eq("client_id", clientId)
    .neq("status", "rejected")
    .gte("service_date", month)
    .lte("service_date", monthEnd);

  for (const row of rows ?? []) {
    const embed = row.service_activity_types as
      | { code?: string; counts_toward_client_billable?: boolean }
      | { code?: string; counts_toward_client_billable?: boolean }[]
      | null;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    if (
      entryCountsTowardClientBillableWithActivity(row as ClientBillableEntry, activity) &&
      (row.duration_minutes as number) > 0
    ) {
      return true;
    }
  }
  return false;
}

export async function loadEligibleIjpClientIdsForMonth(
  admin: SupabaseClient,
  monthStart: string
): Promise<string[]> {
  const gaIjpServiceId = await resolveGaIjpServiceId(admin);
  if (!gaIjpServiceId) return [];

  const { data: clients } = await admin
    .from("clients")
    .select("id")
    .eq("is_demo", false)
    .neq("intake_status", "discarded");

  const ids: string[] = [];
  for (const c of clients ?? []) {
    const id = c.id as string;
    if (await clientOnGaIjpDuringMonth(admin, id, monthStart, gaIjpServiceId)) {
      ids.push(id);
    }
  }
  return ids;
}

export function attestationCaptureWindowOpen(monthStart: string, now = new Date()): boolean {
  const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m, d] = ymd.split("-").map(Number);
  const [msY, msM] = monthStart.split("-").map(Number);
  const monthEnd = serviceMonthEndYmd(monthStart);
  const [meY, meM, meD] = monthEnd.split("-").map(Number);

  const today = Date.UTC(y, m - 1, d);
  const monthStartUtc = Date.UTC(msY, msM - 1, 1);
  const graceEnd = Date.UTC(meY, meM - 1, meD + 15);

  return today >= monthStartUtc && today <= graceEnd;
}

export function serviceMonthLabel(monthStart: string): string {
  const d = new Date(`${monthStart}T12:00:00`);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}
