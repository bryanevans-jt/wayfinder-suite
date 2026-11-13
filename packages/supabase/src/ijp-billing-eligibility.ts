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
  service_date?: string | null;
  service_episode_id?: string | null;
  service_activity_types?:
    | { code?: string; counts_toward_client_billable?: boolean }
    | { code?: string; counts_toward_client_billable?: boolean }[]
    | null;
};

/** Episode fields used to attribute a time entry to IJP. */
export type IjpAttributionEpisode = {
  id?: string | null;
  service_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

/**
 * Whether a service episode covers a calendar service_date (YYYY-MM-DD).
 * Open-ended episodes (ended_at null) cover through far future.
 */
export function episodeCoversServiceDate(
  episode: Pick<IjpAttributionEpisode, "started_at" | "ended_at">,
  serviceDate: string
): boolean {
  const start = (episode.started_at ?? "").slice(0, 10);
  if (!start || !serviceDate) return false;
  const end = episode.ended_at ? episode.ended_at.slice(0, 10) : "9999-12-31";
  return start <= serviceDate && end >= serviceDate;
}

/**
 * Attribute a time entry to IJP (Individual Job Placement / (GA) / IJP — one service).
 *
 * Rules (in order):
 * 1. If the entry has `service_episode_id`, use that episode's `service_id` only
 *    (authoritative for mid-period switches — hours follow the episode on the entry).
 * 2. If the entry has no episode link, attribute to IJP when any of the client's
 *    IJP service episodes covers the entry's `service_date`.
 *
 * Non-IJP episode on the entry → not IJP (other-service hours never land on IJP invoices).
 */
export function timeEntryAttributedToIjpService(opts: {
  serviceDate: string;
  serviceEpisodeId?: string | null;
  /** Episode row for the entry's service_episode_id when known. */
  entryEpisode?: IjpAttributionEpisode | null;
  clientEpisodes: readonly IjpAttributionEpisode[];
  ijpServiceIds: string | readonly string[];
}): boolean {
  const ijpIds = asIjpServiceIdSet(opts.ijpServiceIds);
  const serviceDate = (opts.serviceDate ?? "").slice(0, 10);
  if (!serviceDate || ijpIds.size === 0) return false;

  const episodeId = opts.serviceEpisodeId ?? null;
  if (episodeId) {
    const linked =
      opts.entryEpisode &&
      (!opts.entryEpisode.id || opts.entryEpisode.id === episodeId)
        ? opts.entryEpisode
        : opts.clientEpisodes.find((ep) => ep.id === episodeId) ?? null;
    if (!linked) return false;
    return ijpIds.has((linked.service_id as string) ?? "");
  }

  return opts.clientEpisodes.some(
    (ep) =>
      ijpIds.has((ep.service_id as string) ?? "") &&
      episodeCoversServiceDate(ep, serviceDate)
  );
}

/** Billable + IJP-attributed entries (pure; for generate targets / line filters / tests). */
export function filterIjpAttributedBillableEntries(
  rows: readonly BillableTimeEntryRow[],
  opts: {
    clientEpisodes: readonly IjpAttributionEpisode[];
    ijpServiceIds: string | readonly string[];
    episodesById?: Map<string, IjpAttributionEpisode>;
  }
): BillableTimeEntryRow[] {
  const out: BillableTimeEntryRow[] = [];
  for (const row of rows) {
    const embed = row.service_activity_types;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    if (
      !entryCountsTowardClientBillableWithActivity(row as ClientBillableEntry, activity) ||
      !((row.duration_minutes as number) > 0)
    ) {
      continue;
    }
    const episodeId = row.service_episode_id ?? null;
    const entryEpisode =
      episodeId && opts.episodesById
        ? opts.episodesById.get(episodeId) ?? null
        : episodeId
          ? opts.clientEpisodes.find((ep) => ep.id === episodeId) ?? null
          : null;
    if (
      timeEntryAttributedToIjpService({
        serviceDate: (row.service_date as string) ?? "",
        serviceEpisodeId: episodeId,
        entryEpisode,
        clientEpisodes: opts.clientEpisodes,
        ijpServiceIds: opts.ijpServiceIds,
      })
    ) {
      out.push(row);
    }
  }
  return out;
}

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

/** Sorted unique union — used for month eligibility (hours ∪ IJP-episode). */
export function unionClientIdLists(...lists: Array<readonly string[]>): string[] {
  return Array.from(new Set(lists.flat().filter(Boolean))).sort();
}

/**
 * Sum billable hours from time-entry rows (same billable rules as invoice lines).
 * Pure helper for tests / completeness.
 */
export function sumBillableHoursFromEntries(rows: BillableTimeEntryRow[]): number {
  let minutes = 0;
  for (const row of rows) {
    const embed = row.service_activity_types;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    if (
      entryCountsTowardClientBillableWithActivity(row as ClientBillableEntry, activity) &&
      (row.duration_minutes as number) > 0
    ) {
      minutes += Number(row.duration_minutes) || 0;
    }
  }
  return minutes / 60;
}

async function loadClientEpisodesByClientId(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<{
  byClient: Record<string, IjpAttributionEpisode[]>;
  byId: Map<string, IjpAttributionEpisode>;
}> {
  const uniqueIds = [...new Set(clientIds.filter(Boolean))];
  const byClient: Record<string, IjpAttributionEpisode[]> = {};
  const byId = new Map<string, IjpAttributionEpisode>();
  for (const id of uniqueIds) byClient[id] = [];
  if (uniqueIds.length === 0) return { byClient, byId };

  const episodes = await fetchAllPostgrestRowsByIn<{
    id: string;
    client_id: string;
    service_id: string | null;
    started_at: string | null;
    ended_at: string | null;
  }>(
    admin,
    "service_episodes",
    "id, client_id, service_id, started_at, ended_at",
    "client_id",
    uniqueIds,
    { order: { column: "client_id", ascending: true } }
  );
  for (const ep of episodes) {
    const clientId = ep.client_id as string;
    const row: IjpAttributionEpisode = {
      id: ep.id as string,
      service_id: ep.service_id,
      started_at: ep.started_at,
      ended_at: ep.ended_at,
    };
    byId.set(row.id as string, row);
    const list = byClient[clientId] ?? [];
    list.push(row);
    byClient[clientId] = list;
  }
  return { byClient, byId };
}

async function loadBillableHoursClientIdsInMonth(
  admin: SupabaseClient,
  monthStart: string,
  opts?: { unbilledOnly?: boolean }
): Promise<string[]> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const unbilledOnly = opts?.unbilledOnly === true;
  const ijpServiceIds = await resolveGaIjpServiceIds(admin);
  if (ijpServiceIds.length === 0) return [];

  const rows = await fetchAllPostgrestRows<
    BillableTimeEntryRow & {
      client_id: string;
      ijp_billed_invoice_id?: string | null;
    }
  >(
    admin,
    "es_time_entries",
    "client_id, service_episode_id, duration_minutes, flags, client_present, delivery_mode, service_date, status, ijp_billed_invoice_id, service_activity_types ( code, counts_toward_client_billable )",
    {
      order: [
        { column: "client_id", ascending: true },
        { column: "service_date", ascending: true },
      ],
      applyFilters: (query) => {
        let q = query
          .neq("status", "rejected")
          .gte("service_date", month)
          .lte("service_date", monthEnd);
        if (unbilledOnly) {
          q = q.is("ijp_billed_invoice_id", null);
        }
        return q;
      },
    }
  );

  const clientIds = [
    ...new Set(rows.map((r) => r.client_id as string).filter(Boolean)),
  ];
  if (clientIds.length === 0) return [];

  const { byClient: episodesByClient, byId: episodesById } =
    await loadClientEpisodesByClientId(admin, clientIds);

  const withIjpHours = new Set<string>();
  const byClientEntries: Record<string, BillableTimeEntryRow[]> = {};
  for (const row of rows) {
    const clientId = row.client_id as string;
    if (!clientId) continue;
    const list = byClientEntries[clientId] ?? [];
    list.push(row);
    byClientEntries[clientId] = list;
  }
  for (const [clientId, entries] of Object.entries(byClientEntries)) {
    const ijpEntries = filterIjpAttributedBillableEntries(entries, {
      clientEpisodes: episodesByClient[clientId] ?? [],
      ijpServiceIds,
      episodesById,
    });
    if (ijpEntries.length > 0) withIjpHours.add(clientId);
  }
  if (withIjpHours.size === 0) return [];

  const profiles = await fetchAllPostgrestRowsByIn<{
    id: string;
    is_demo: boolean | null;
  }>(admin, "clients", "id, is_demo", "id", [...withIjpHours], {
    order: { column: "id", ascending: true },
  });
  const demoIds = new Set(
    profiles.filter((p) => p.is_demo === true).map((p) => p.id as string)
  );
  return [...withIjpHours].filter((id) => !demoIds.has(id)).sort();
}

/**
 * Every client with billable IJP-attributed `es_time_entries` in the service month.
 * Includes archived / closed / discarded / any assignee role. Excludes demo and
 * clients whose only hours are on non-IJP services.
 */
export async function loadClientIdsWithBillableHoursInMonth(
  admin: SupabaseClient,
  monthStart: string
): Promise<string[]> {
  return loadBillableHoursClientIdsInMonth(admin, monthStart, { unbilledOnly: false });
}

/**
 * Clients with unbilled IJP-attributed billable hours (Generate Invoices targets).
 * Includes archived/closed and late-entered IJP hours for past periods.
 */
export async function loadClientIdsWithUnbilledBillableHoursInMonth(
  admin: SupabaseClient,
  monthStart: string
): Promise<string[]> {
  return loadBillableHoursClientIdsInMonth(admin, monthStart, { unbilledOnly: true });
}

/** Shared helper: does this client have unbilled IJP-attributed billable hours in the month? */
export async function clientHasUnbilledIjpBillableHoursInMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string
): Promise<boolean> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const ijpServiceIds = await resolveGaIjpServiceIds(admin);
  if (ijpServiceIds.length === 0) return false;

  const { data: rows } = await admin
    .from("es_time_entries")
    .select(
      "id, service_episode_id, duration_minutes, flags, client_present, delivery_mode, service_date, status, ijp_billed_invoice_id, service_activity_types ( code, counts_toward_client_billable )"
    )
    .eq("client_id", clientId)
    .is("ijp_billed_invoice_id", null)
    .neq("status", "rejected")
    .gte("service_date", month)
    .lte("service_date", monthEnd);

  const { byClient, byId } = await loadClientEpisodesByClientId(admin, [clientId]);
  const ijpEntries = filterIjpAttributedBillableEntries(
    (rows ?? []) as BillableTimeEntryRow[],
    {
      clientEpisodes: byClient[clientId] ?? [],
      ijpServiceIds,
      episodesById: byId,
    }
  );
  return ijpEntries.length > 0;
}

/**
 * IJP-episode / current-service eligibility for the month (existing logic).
 * Demo clients excluded. Archived/discarded are kept when episodes overlap
 * (or when current service is IJP and not archived-before-month).
 */
export async function loadIjpEpisodeEligibleClientIdsForMonth(
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
      applyFilters: (query) => query.eq("is_demo", false),
    }
  );

  const ids = clients.map((c) => c.id as string);
  if (ids.length === 0) return [];

  const snapshots = await loadGaIjpEligibilitySnapshots(admin, ids, gaIjpServiceIds);
  return filterClientIdsOnGaIjpDuringMonth(snapshots, monthStart, gaIjpServiceIds).sort();
}

/**
 * Month eligibility for IJP invoices = clients with billable IJP-attributed hours
 * in the month (archived/closed included; demo excluded). Episode-only clients
 * with no IJP hours do not get an invoice.
 */
export async function loadEligibleIjpClientIdsForMonth(
  admin: SupabaseClient,
  monthStart: string
): Promise<string[]> {
  return loadClientIdsWithBillableHoursInMonth(admin, monthStart);
}

export type IjpBillingMonthCompleteness = {
  serviceMonth: string;
  clientsWithBillableHours: number;
  invoicesPresent: number;
  missingClientIds: string[];
  missingCount: number;
  complete: boolean;
};

/**
 * Completeness for admins / Accounts Specialists:
 * every client with still-unbilled billable hours should be picked up by generate.
 * Also reports clients with any billable hours who lack an invoice row.
 */
export async function loadIjpBillingMonthCompleteness(
  admin: SupabaseClient,
  monthStart: string,
  opts?: { isTest?: boolean }
): Promise<IjpBillingMonthCompleteness & { clientsWithUnbilledHours: number }> {
  const month = serviceMonthStartFromYmd(monthStart);
  const isTest = opts?.isTest === true;
  const [hoursIds, unbilledIds] = await Promise.all([
    loadClientIdsWithBillableHoursInMonth(admin, month),
    loadClientIdsWithUnbilledBillableHoursInMonth(admin, month),
  ]);
  const invoices = await fetchAllPostgrestRows<{ client_id: string }>(
    admin,
    "ijp_billing_invoices",
    "client_id",
    {
      order: { column: "client_id", ascending: true },
      applyFilters: (query) =>
        query.eq("service_month", month).eq("is_test", isTest),
    }
  );
  const present = new Set(invoices.map((row) => row.client_id as string).filter(Boolean));
  // Missing = still have unbilled hours (weekly generate still has work) OR never invoiced.
  const missingClientIds = Array.from(
    new Set([
      ...unbilledIds,
      ...hoursIds.filter((id) => !present.has(id)),
    ])
  ).sort();
  return {
    serviceMonth: month,
    clientsWithBillableHours: hoursIds.length,
    clientsWithUnbilledHours: unbilledIds.length,
    invoicesPresent: hoursIds.filter((id) => present.has(id)).length,
    missingClientIds,
    missingCount: missingClientIds.length,
    complete: missingClientIds.length === 0,
  };
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
