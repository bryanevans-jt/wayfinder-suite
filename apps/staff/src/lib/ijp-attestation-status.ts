import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attestationCaptureWindowOpen,
  clientHasBillableTimeFromEntries,
  clientHasBillableTimeInMonth,
  clientOnGaIjpDuringMonth,
  clientOnGaIjpDuringMonthFromRows,
  currentServiceMonthStart,
  priorServiceMonthStart,
  serviceMonthEndYmd,
  serviceMonthLabel,
  serviceMonthStartFromYmd,
  type BillableTimeEntryRow,
  type GaIjpClientRow,
  type GaIjpEpisodeRow,
  type GaIjpServiceRow,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { resolveGaIjpServiceIds } from "@wayfinder/supabase/ijp-billing-settings";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";

export type IjpSignatureUiStatus = {
  serviceMonth: string;
  serviceMonthLabel: string;
  signatureNeeded: boolean;
  hasAttestation: boolean;
  showListFlag: boolean;
  /** Show Collect IJP signature on caseload / client pages for GA IJP clients in the capture window. */
  showCollectSignature: boolean;
  captureOpen: boolean;
  isTest: false;
};

export type IjpSignatureClientSnapshot = {
  client: GaIjpClientRow | null;
  episodes: GaIjpEpisodeRow[];
  currentService: GaIjpServiceRow | null;
  billableByMonth: Record<string, BillableTimeEntryRow[]>;
  hasAttestationByMonth: Record<string, boolean>;
};

function isOnOrAfter25thForMonth(monthStart: string, now: Date): boolean {
  const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
  const [y, m, d] = ymd.split("-").map(Number);
  const [msY, msM] = monthStart.split("-").map(Number);
  if (y > msY || (y === msY && m > msM)) return true;
  if (y === msY && m === msM && d >= 25) return true;
  return false;
}

function onIjpForMonth(
  snapshot: IjpSignatureClientSnapshot,
  monthStart: string,
  gaIjpServiceId: string | readonly string[]
): boolean {
  return clientOnGaIjpDuringMonthFromRows(
    snapshot.episodes,
    snapshot.client,
    snapshot.currentService,
    monthStart,
    gaIjpServiceId
  );
}

function statusForMonth(
  snapshot: IjpSignatureClientSnapshot,
  monthStart: string,
  gaIjpServiceId: string | readonly string[],
  now: Date
): IjpSignatureUiStatus | null {
  if (!onIjpForMonth(snapshot, monthStart, gaIjpServiceId)) return null;

  const hasBillable = clientHasBillableTimeFromEntries(
    snapshot.billableByMonth[monthStart] ?? []
  );
  const hasAttestation = Boolean(snapshot.hasAttestationByMonth[monthStart]);
  const signatureNeeded = hasBillable && !hasAttestation;
  const showListFlag = signatureNeeded && isOnOrAfter25thForMonth(monthStart, now);
  const captureOpen = attestationCaptureWindowOpen(monthStart, now);

  return {
    serviceMonth: monthStart,
    serviceMonthLabel: serviceMonthLabel(monthStart),
    signatureNeeded,
    hasAttestation,
    showListFlag,
    showCollectSignature: captureOpen,
    captureOpen,
    isTest: false,
  };
}

/**
 * Pure status computation from a preloaded client snapshot.
 * Used by both the single-client loader and the batched list-flags path.
 */
export function computeIjpSignatureUiStatusFromSnapshot(
  snapshot: IjpSignatureClientSnapshot,
  gaIjpServiceId: string | readonly string[],
  now = new Date()
): IjpSignatureUiStatus | null {
  const monthStart = currentServiceMonthStart(now);
  const onIjp = onIjpForMonth(snapshot, monthStart, gaIjpServiceId);
  if (!onIjp) {
    const prior = priorServiceMonthStart(now);
    if (attestationCaptureWindowOpen(prior, now)) {
      if (onIjpForMonth(snapshot, prior, gaIjpServiceId)) {
        return statusForMonth(snapshot, prior, gaIjpServiceId, now);
      }
    }
    return null;
  }

  if (attestationCaptureWindowOpen(monthStart, now)) {
    return statusForMonth(snapshot, monthStart, gaIjpServiceId, now);
  }

  const prior = priorServiceMonthStart(now);
  if (attestationCaptureWindowOpen(prior, now)) {
    return statusForMonth(snapshot, prior, gaIjpServiceId, now);
  }

  return statusForMonth(snapshot, monthStart, gaIjpServiceId, now);
}

/** Pure batch: same logic as computing each client independently. */
export function computeIjpSignatureListFlagsFromSnapshots(
  snapshotsByClientId: Record<string, IjpSignatureClientSnapshot>,
  gaIjpServiceId: string | readonly string[],
  now = new Date()
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [clientId, snapshot] of Object.entries(snapshotsByClientId)) {
    const status = computeIjpSignatureUiStatusFromSnapshot(snapshot, gaIjpServiceId, now);
    if (status?.showListFlag) {
      out[clientId] = status.serviceMonthLabel;
    }
  }
  return out;
}

async function loadForMonth(
  admin: SupabaseClient,
  clientId: string,
  monthStart: string,
  now: Date,
  gaIjpServiceId: string | readonly string[]
): Promise<IjpSignatureUiStatus | null> {
  const onIjp = await clientOnGaIjpDuringMonth(admin, clientId, monthStart, gaIjpServiceId);
  if (!onIjp) return null;

  const hasBillable = await clientHasBillableTimeInMonth(admin, clientId, monthStart);
  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("id")
    .eq("client_id", clientId)
    .eq("service_month", monthStart)
    .eq("is_test", false)
    .not("attestation_drive_file_id", "is", null)
    .maybeSingle();

  const hasAttestation = Boolean(att?.id);
  const signatureNeeded = hasBillable && !hasAttestation;
  const showListFlag = signatureNeeded && isOnOrAfter25thForMonth(monthStart, now);

  const captureOpen = attestationCaptureWindowOpen(monthStart, now);

  return {
    serviceMonth: monthStart,
    serviceMonthLabel: serviceMonthLabel(monthStart),
    signatureNeeded,
    hasAttestation,
    showListFlag,
    showCollectSignature: captureOpen,
    captureOpen,
    isTest: false,
  };
}

/** Production attestation UI state for profile / client lists (never includes test rows). */
export async function loadIjpSignatureUiStatus(
  admin: SupabaseClient,
  clientId: string,
  now = new Date(),
  gaIjpServiceIdResolved?: string | readonly string[] | null
): Promise<IjpSignatureUiStatus | null> {
  const gaIjpServiceId =
    gaIjpServiceIdResolved === undefined
      ? await resolveGaIjpServiceIds(admin)
      : gaIjpServiceIdResolved;
  if (
    gaIjpServiceId == null ||
    (Array.isArray(gaIjpServiceId) ? gaIjpServiceId.length === 0 : !gaIjpServiceId)
  ) {
    return null;
  }

  const monthStart = currentServiceMonthStart(now);
  const onIjp = await clientOnGaIjpDuringMonth(admin, clientId, monthStart, gaIjpServiceId);
  if (!onIjp) {
    const prior = priorServiceMonthStart(now);
    if (attestationCaptureWindowOpen(prior, now)) {
      const onPrior = await clientOnGaIjpDuringMonth(admin, clientId, prior, gaIjpServiceId);
      if (onPrior) {
        return loadForMonth(admin, clientId, prior, now, gaIjpServiceId);
      }
    }
    return null;
  }

  if (attestationCaptureWindowOpen(monthStart, now)) {
    return loadForMonth(admin, clientId, monthStart, now, gaIjpServiceId);
  }

  const prior = priorServiceMonthStart(now);
  if (attestationCaptureWindowOpen(prior, now)) {
    return loadForMonth(admin, clientId, prior, now, gaIjpServiceId);
  }

  return loadForMonth(admin, clientId, monthStart, now, gaIjpServiceId);
}

function monthsNeededForFlags(now: Date): string[] {
  const current = currentServiceMonthStart(now);
  const prior = priorServiceMonthStart(now);
  const months = new Set<string>([current]);
  if (attestationCaptureWindowOpen(prior, now)) months.add(prior);
  return [...months];
}

async function loadBillableEntriesForClients(
  admin: SupabaseClient,
  clientIds: string[],
  monthStart: string
): Promise<Map<string, BillableTimeEntryRow[]>> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const byClient = new Map<string, BillableTimeEntryRow[]>();
  if (clientIds.length === 0) return byClient;

  const { data: rows } = await admin
    .from("es_time_entries")
    .select(
      "client_id, duration_minutes, flags, client_present, delivery_mode, service_date, status, service_activity_types ( code, counts_toward_client_billable )"
    )
    .in("client_id", clientIds)
    .neq("status", "rejected")
    .gte("service_date", month)
    .lte("service_date", monthEnd);

  for (const row of rows ?? []) {
    const clientId = row.client_id as string;
    const list = byClient.get(clientId) ?? [];
    list.push(row as BillableTimeEntryRow);
    byClient.set(clientId, list);
  }
  return byClient;
}

async function loadIjpSignatureSnapshotsBatched(
  admin: SupabaseClient,
  clientIds: string[],
  now: Date
): Promise<{
  gaIjpServiceId: string | string[];
  snapshotsByClientId: Record<string, IjpSignatureClientSnapshot>;
} | null> {
  if (clientIds.length === 0) return null;

  const gaIjpServiceId = await resolveGaIjpServiceIds(admin);
  if (gaIjpServiceId.length === 0) return null;

  const months = monthsNeededForFlags(now);

  const [{ data: clients }, { data: episodes }, { data: attestations }] = await Promise.all([
    admin
      .from("clients")
      .select("id, current_service_id, archived_at, is_demo, intake_status")
      .in("id", clientIds),
    admin
      .from("service_episodes")
      .select("client_id, service_id, started_at, ended_at")
      .in("client_id", clientIds),
    admin
      .from("ijp_monthly_attestations")
      .select("client_id, service_month, attestation_drive_file_id")
      .in("client_id", clientIds)
      .in("service_month", months)
      .eq("is_test", false)
      .not("attestation_drive_file_id", "is", null),
  ]);

  const clientsById = new Map(
    (clients ?? []).map((c) => [c.id as string, c as GaIjpClientRow & { id: string }])
  );
  const episodesByClient = new Map<string, GaIjpEpisodeRow[]>();
  for (const ep of episodes ?? []) {
    const clientId = ep.client_id as string;
    const list = episodesByClient.get(clientId) ?? [];
    list.push(ep as GaIjpEpisodeRow);
    episodesByClient.set(clientId, list);
  }

  const ijpIdSet = new Set(gaIjpServiceId);
  const serviceIds = [
    ...new Set(
      (clients ?? [])
        .map((c) => c.current_service_id as string | null)
        .filter((id): id is string => typeof id === "string" && id.length > 0 && !ijpIdSet.has(id))
    ),
  ];
  const { data: services } = serviceIds.length
    ? await admin.from("services").select("id, name, state").in("id", serviceIds)
    : { data: [] as Array<{ id: string; name: string | null; state: string | null }> };
  const servicesById = new Map(
    (services ?? []).map((s) => [s.id as string, s as GaIjpServiceRow & { id: string }])
  );

  const billableByMonth = new Map<string, Map<string, BillableTimeEntryRow[]>>();
  await Promise.all(
    months.map(async (month) => {
      billableByMonth.set(month, await loadBillableEntriesForClients(admin, clientIds, month));
    })
  );

  const attestationByClientMonth = new Map<string, Set<string>>();
  for (const att of attestations ?? []) {
    const clientId = att.client_id as string;
    const month = att.service_month as string;
    const set = attestationByClientMonth.get(clientId) ?? new Set<string>();
    set.add(month);
    attestationByClientMonth.set(clientId, set);
  }

  const snapshotsByClientId: Record<string, IjpSignatureClientSnapshot> = {};
  for (const clientId of clientIds) {
    const client = clientsById.get(clientId) ?? null;
    const currentServiceId = client?.current_service_id ?? null;
    const billableByMonthForClient: Record<string, BillableTimeEntryRow[]> = {};
    const hasAttestationByMonth: Record<string, boolean> = {};
    for (const month of months) {
      billableByMonthForClient[month] = billableByMonth.get(month)?.get(clientId) ?? [];
      hasAttestationByMonth[month] = Boolean(
        attestationByClientMonth.get(clientId)?.has(month)
      );
    }
    snapshotsByClientId[clientId] = {
      client,
      episodes: episodesByClient.get(clientId) ?? [],
      currentService: currentServiceId ? (servicesById.get(currentServiceId) ?? null) : null,
      billableByMonth: billableByMonthForClient,
      hasAttestationByMonth,
    };
  }

  return { gaIjpServiceId, snapshotsByClientId };
}

/**
 * Batched list-flag loader: resolves GA IJP service once and fans out a few
 * IN queries instead of per-client status loads.
 */
export async function loadIjpSignatureListFlagsBatched(
  admin: SupabaseClient,
  clientIds: string[],
  now = new Date()
): Promise<Record<string, string>> {
  const loaded = await loadIjpSignatureSnapshotsBatched(admin, clientIds, now);
  if (!loaded) return {};
  return computeIjpSignatureListFlagsFromSnapshots(
    loaded.snapshotsByClientId,
    loaded.gaIjpServiceId,
    now
  );
}

/** Batched statuses for caseload UI (list badges + collect-signature affordance). */
export async function loadIjpSignatureUiStatusesBatched(
  admin: SupabaseClient,
  clientIds: string[],
  now = new Date()
): Promise<Record<string, IjpSignatureUiStatus>> {
  const loaded = await loadIjpSignatureSnapshotsBatched(admin, clientIds, now);
  if (!loaded) return {};

  const out: Record<string, IjpSignatureUiStatus> = {};
  for (const [clientId, snapshot] of Object.entries(loaded.snapshotsByClientId)) {
    const status = computeIjpSignatureUiStatusFromSnapshot(
      snapshot,
      loaded.gaIjpServiceId,
      now
    );
    if (status) out[clientId] = status;
  }
  return out;
}
