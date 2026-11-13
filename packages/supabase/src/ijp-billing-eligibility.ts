import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  type ClientBillableEntry,
} from "./client-billable";
import {
  fetchAllPostgrestRows,
  fetchAllPostgrestRowsByIn,
} from "./postgrest-fetch-all";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";
import { resolveGaIjpServiceIds } from "./ijp-billing-settings";
import { isIndividualJobPlacementServiceName } from "./ijp-stages";

function asIjpServiceIdSet(gaIjpServiceId: string | readonly string[]): Set<string> {
  return new Set(
    (Array.isArray(gaIjpServiceId) ? gaIjpServiceId : [gaIjpServiceId]).filter(Boolean)
  );
}

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

export type GaIjpEpisodeRow = {
  service_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type GaIjpClientRow = {
  current_service_id: string | null;
  archived_at: string | null;
  is_demo?: boolean | null;
  intake_status?: string | null;
};

export type GaIjpServiceRow = {
  name: string | null;
  state: string | null;
};

export type BillableTimeEntryRow = ClientBillableEntry & {
  duration_minutes: number;
  service_activity_types?:
    | { code?: string; counts_toward_client_billable?: boolean }
    | { code?: string; counts_toward_client_billable?: boolean }[]
    | null;
};

/** Pure: client on GA IJP at least one day in the calendar month (episode overlap). */
export function clientOnGaIjpDuringMonthFromRows(
  episodes: GaIjpEpisodeRow[],
  client: GaIjpClientRow | null | undefined,
  service: GaIjpServiceRow | null | undefined,
  monthStart: string,
  gaIjpServiceId: string | readonly string[]
): boolean {
  const monthEnd = serviceMonthEndYmd(monthStart);
  const ijpIds = asIjpServiceIdSet(gaIjpServiceId);

  for (const ep of episodes) {
    if (!ijpIds.has((ep.service_id as string) ?? "")) continue;
    const start = (ep.started_at as string)?.slice(0, 10) ?? "";
    const end = (ep.ended_at as string)?.slice(0, 10) ?? monthEnd;
    if (start <= monthEnd && end >= monthStart) {
      return true;
    }
  }

  if (!client || client.is_demo) return false;
  if (ijpIds.has((client.current_service_id as string) ?? "")) {
    const archived = client.archived_at as string | null;
    if (archived && archived.slice(0, 10) < monthStart) return false;
    return true;
  }

  // Name-based fallback when catalog has multiple IJP rows and ids were incomplete.
  if (service && isIndividualJobPlacementServiceName(service.name as string)) {
    const state = ((service.state as string) ?? "").trim().toUpperCase();
    if (!state || state === "GA") return true;
  }

  return false;
}

/** Pure: any billable (non-rejected) time in the service month. */
export function clientHasBillableTimeFromEntries(rows: BillableTimeEntryRow[]): boolean {
  for (const row of rows) {
    const embed = row.service_activity_types;
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

/** Client on GA IJP at least one day in the calendar month (episode overlap). */
export async function clientOnGaIjpDuringMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string,
  gaIjpServiceId: string | readonly string[]
): Promise<boolean> {
  const ijpIds = asIjpServiceIdSet(gaIjpServiceId);
  const { data: episodes } = await admin
    .from("service_episodes")
    .select("service_id, started_at, ended_at, status")
    .eq("client_id", clientId);

  const { data: client } = await admin
    .from("clients")
    .select("current_service_id, archived_at, is_demo, intake_status")
    .eq("id", clientId)
    .maybeSingle();

  let service: GaIjpServiceRow | null = null;
  const currentServiceId = (client?.current_service_id as string | null) ?? null;
  if (currentServiceId && !ijpIds.has(currentServiceId)) {
    const { data: svc } = await admin
      .from("services")
      .select("name, state")
      .eq("id", currentServiceId)
      .maybeSingle();
    service = (svc as GaIjpServiceRow | null) ?? null;
  }

  return clientOnGaIjpDuringMonthFromRows(
    (episodes ?? []) as GaIjpEpisodeRow[],
    client as GaIjpClientRow | null,
    service,
    monthStart,
    [...ijpIds]
  );
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

  return clientHasBillableTimeFromEntries((rows ?? []) as BillableTimeEntryRow[]);
}

export type GaIjpEligibilitySnapshot = {
  client: GaIjpClientRow | null;
  episodes: GaIjpEpisodeRow[];
  currentService: GaIjpServiceRow | null;
};

/** Batched GA IJP eligibility rows for many clients (few IN queries). */
export async function loadGaIjpEligibilitySnapshots(
  admin: SupabaseClient,
  clientIds: string[],
  gaIjpServiceId: string | readonly string[]
): Promise<Record<string, GaIjpEligibilitySnapshot>> {
  const ijpIds = asIjpServiceIdSet(gaIjpServiceId);
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  const out: Record<string, GaIjpEligibilitySnapshot> = {};
  for (const id of uniqueIds) {
    out[id] = { client: null, episodes: [], currentService: null };
  }
  if (uniqueIds.length === 0) return out;

  const [clients, episodes] = await Promise.all([
    fetchAllPostgrestRowsByIn<{
      id: string;
      current_service_id: string | null;
      archived_at: string | null;
      is_demo: boolean | null;
      intake_status: string | null;
    }>(admin, "clients", "id, current_service_id, archived_at, is_demo, intake_status", "id", uniqueIds, {
      order: { column: "id", ascending: true },
    }),
    fetchAllPostgrestRowsByIn<{
      client_id: string;
      service_id: string | null;
      started_at: string | null;
      ended_at: string | null;
    }>(
      admin,
      "service_episodes",
      "client_id, service_id, started_at, ended_at",
      "client_id",
      uniqueIds,
      { order: { column: "client_id", ascending: true } }
    ),
  ]);

  for (const row of clients) {
    const id = row.id as string;
    out[id] = {
      ...out[id],
      client: row as GaIjpClientRow,
    };
  }

  for (const ep of episodes) {
    const clientId = ep.client_id as string;
    const snap = out[clientId];
    if (!snap) continue;
    snap.episodes.push(ep as GaIjpEpisodeRow);
  }

  const serviceIds = [
    ...new Set(
      clients
        .map((c) => c.current_service_id as string | null)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && !ijpIds.has(id))
    ),
  ];
  if (serviceIds.length > 0) {
    const services = await fetchAllPostgrestRowsByIn<{
      id: string;
      name: string | null;
      state: string | null;
    }>(admin, "services", "id, name, state", "id", serviceIds, {
      order: { column: "id", ascending: true },
    });
    const servicesById = new Map(services.map((s) => [s.id as string, s as GaIjpServiceRow]));
    for (const clientId of uniqueIds) {
      const currentServiceId = out[clientId]?.client?.current_service_id ?? null;
      if (currentServiceId && !ijpIds.has(currentServiceId)) {
        out[clientId].currentService = servicesById.get(currentServiceId) ?? null;
      }
    }
  }

  return out;
}

export function filterClientIdsOnGaIjpDuringMonth(
  snapshots: Record<string, GaIjpEligibilitySnapshot>,
  monthStart: string,
  gaIjpServiceId: string | readonly string[]
): string[] {
  const ids: string[] = [];
  for (const [clientId, snap] of Object.entries(snapshots)) {
    if (
      clientOnGaIjpDuringMonthFromRows(
        snap.episodes,
        snap.client,
        snap.currentService,
        monthStart,
        gaIjpServiceId
      )
    ) {
      ids.push(clientId);
    }
  }
  return ids;
}

/** Batched billable time entries keyed by client_id for a service month. */
export async function loadBillableTimeEntriesByClient(
  admin: SupabaseClient,
  clientIds: string[],
  monthStart: string
): Promise<Record<string, BillableTimeEntryRow[]>> {
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  const byClient: Record<string, BillableTimeEntryRow[]> = {};
  for (const id of uniqueIds) byClient[id] = [];
  if (uniqueIds.length === 0) return byClient;

  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const rows = await fetchAllPostgrestRowsByIn<
    BillableTimeEntryRow & { client_id: string }
  >(
    admin,
    "es_time_entries",
    "client_id, duration_minutes, flags, client_present, delivery_mode, service_date, status, service_activity_types ( code, counts_toward_client_billable )",
    "client_id",
    uniqueIds,
    {
      order: { column: "client_id", ascending: true },
      applyFilters: (query) =>
        query
          .neq("status", "rejected")
          .gte("service_date", month)
          .lte("service_date", monthEnd),
    }
  );

  for (const row of rows) {
    const clientId = row.client_id as string;
    const list = byClient[clientId] ?? [];
    list.push(row);
    byClient[clientId] = list;
  }
  return byClient;
}

export function filterClientIdsWithBillableTime(
  entriesByClient: Record<string, BillableTimeEntryRow[]>
): string[] {
  const ids: string[] = [];
  for (const [clientId, rows] of Object.entries(entriesByClient)) {
    if (clientHasBillableTimeFromEntries(rows)) ids.push(clientId);
  }
  return ids;
}

export async function loadEligibleIjpClientIdsForMonth(
  admin: SupabaseClient,
  monthStart: string
): Promise<string[]> {
  const gaIjpServiceIds = await resolveGaIjpServiceIds(admin);
  if (gaIjpServiceIds.length === 0) return [];

  const clients = await fetchAllPostgrestRows<{ id: string }>(
    admin,
    "clients",
    "id",
    {
      order: { column: "id", ascending: true },
      applyFilters: (query) =>
        query.eq("is_demo", false).neq("intake_status", "discarded"),
    }
  );

  const ids = clients.map((c) => c.id as string);
  if (ids.length === 0) return [];

  const snapshots = await loadGaIjpEligibilitySnapshots(admin, ids, gaIjpServiceIds);
  return filterClientIdsOnGaIjpDuringMonth(snapshots, monthStart, gaIjpServiceIds);
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
