/**
 * IJP Billing month hours ledger: every IJP-attributed entry for the month,
 * grouped by client, with billed/unbilled and attestation status.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientDisplayNameFromRosterAndProfile,
  clientNameSortKey,
  compareClientNameSortKeys,
} from "@wayfinder/branding";
import {
  classifyIjpTimeEntryAttribution,
  partitionBillableEntriesByIjpAttribution,
  serviceMonthEndYmd,
  serviceMonthStartFromYmd,
  sumBillableHoursFromEntries,
  type BillableTimeEntryRow,
  type IjpAttributionEpisode,
} from "./ijp-billing-eligibility";
import { resolveGaIjpServiceIds } from "./ijp-billing-settings";
import {
  fetchAllPostgrestRows,
  fetchAllPostgrestRowsByIn,
} from "./postgrest-fetch-all";

export type IjpLedgerEntryRow = {
  entryId: string;
  clientId: string;
  serviceDate: string;
  durationMinutes: number;
  hours: number;
  activityCode: string | null;
  activityLabel: string | null;
  billed: boolean;
  invoiceId: string | null;
  providerInvoiceNumber: string | null;
  attribution: "ijp" | "unattributed";
};

export type IjpLedgerInvoiceSummary = {
  id: string;
  providerInvoiceNumber: string | null;
  totalHours: number;
  compiledAt: string | null;
  needsRebuild: boolean;
  missingAttestation: boolean;
  isEmpty: boolean;
};

export type IjpLedgerAttestationStatus = {
  hasAttestation: boolean;
  capturedAt: string | null;
  driveFileId: string | null;
  driveFileName: string | null;
  driveUrl: string | null;
};

export type IjpLedgerClientGroup = {
  clientId: string;
  clientName: string;
  archived: boolean;
  sortLastName: string;
  sortFirstName: string;
  ijpHours: number;
  unbilledHours: number;
  unattributedHours: number;
  attestation: IjpLedgerAttestationStatus;
  invoices: IjpLedgerInvoiceSummary[];
  entries: IjpLedgerEntryRow[];
  unattributedEntries: IjpLedgerEntryRow[];
};

export type IjpBillingMonthLedger = {
  month: string;
  clients: IjpLedgerClientGroup[];
  totals: {
    ijpEntries: number;
    unbilledEntries: number;
    unattributedEntries: number;
    clientsWithUnbilled: number;
    complete: boolean;
  };
};

function driveFileUrl(fileId: string | null | undefined): string | null {
  if (!fileId?.trim()) return null;
  return `https://drive.google.com/file/d/${fileId.trim()}/view`;
}

function activityFromRow(row: BillableTimeEntryRow): {
  code: string | null;
  label: string | null;
} {
  const embed = row.service_activity_types;
  const activity = Array.isArray(embed) ? embed[0] : embed;
  if (!activity || typeof activity !== "object") return { code: null, label: null };
  const code = typeof activity.code === "string" ? activity.code : null;
  return { code, label: code };
}

async function loadClientEpisodes(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<{
  byClient: Record<string, IjpAttributionEpisode[]>;
  byId: Map<string, IjpAttributionEpisode>;
}> {
  const byClient: Record<string, IjpAttributionEpisode[]> = {};
  const byId = new Map<string, IjpAttributionEpisode>();
  for (const id of clientIds) byClient[id] = [];
  if (clientIds.length === 0) return { byClient, byId };

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
    clientIds,
    { order: { column: "client_id", ascending: true } }
  );
  for (const ep of episodes) {
    const row: IjpAttributionEpisode = {
      id: ep.id,
      service_id: ep.service_id,
      started_at: ep.started_at,
      ended_at: ep.ended_at,
    };
    byId.set(ep.id, row);
    const list = byClient[ep.client_id] ?? [];
    list.push(row);
    byClient[ep.client_id] = list;
  }
  return { byClient, byId };
}

/**
 * Full month ledger: IJP + unattributed billable entries, invoices (incl. empty,
 * flagged but not primary), live attestation. Sorted by client last name.
 */
export async function loadIjpBillingMonthLedger(
  admin: SupabaseClient,
  monthStart: string,
  opts?: { isTest?: boolean }
): Promise<IjpBillingMonthLedger> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const isTest = opts?.isTest === true;
  const ijpServiceIds = await resolveGaIjpServiceIds(admin);
  if (ijpServiceIds.length === 0) {
    return {
      month,
      clients: [],
      totals: {
        ijpEntries: 0,
        unbilledEntries: 0,
        unattributedEntries: 0,
        clientsWithUnbilled: 0,
        complete: true,
      },
    };
  }

  const [entries, invoices, attestations] = await Promise.all([
    fetchAllPostgrestRows<
      BillableTimeEntryRow & {
        id: string;
        client_id: string;
        ijp_billed_invoice_id?: string | null;
      }
    >(
      admin,
      "es_time_entries",
      "id, client_id, service_episode_id, duration_minutes, flags, client_present, delivery_mode, service_date, status, ijp_billed_invoice_id, service_activity_types ( code, counts_toward_client_billable )",
      {
        order: [
          { column: "client_id", ascending: true },
          { column: "service_date", ascending: true },
        ],
        applyFilters: (query) =>
          query
            .neq("status", "rejected")
            .gte("service_date", month)
            .lte("service_date", monthEnd),
      }
    ),
    fetchAllPostgrestRows<{
      id: string;
      client_id: string;
      provider_invoice_number: string | null;
      total_hours: number;
      compiled_at: string | null;
      needs_rebuild: boolean | null;
      missing_attestation: boolean;
      line_items: unknown;
    }>(
      admin,
      "ijp_billing_invoices",
      "id, client_id, provider_invoice_number, total_hours, compiled_at, needs_rebuild, missing_attestation, line_items",
      {
        order: { column: "created_at", ascending: true },
        applyFilters: (query) =>
          query.eq("service_month", month).eq("is_test", isTest),
      }
    ),
    fetchAllPostgrestRows<{
      client_id: string;
      attestation_drive_file_id: string | null;
      attestation_drive_file_name: string | null;
      captured_at: string | null;
    }>(
      admin,
      "ijp_monthly_attestations",
      "client_id, attestation_drive_file_id, attestation_drive_file_name, captured_at",
      {
        order: { column: "client_id", ascending: true },
        applyFilters: (query) =>
          query.eq("service_month", month).eq("is_test", isTest),
      }
    ),
  ]);

  const entryClientIds = [
    ...new Set(entries.map((r) => r.client_id as string).filter(Boolean)),
  ];
  const invoiceClientIds = [
    ...new Set(invoices.map((r) => r.client_id as string).filter(Boolean)),
  ];
  const allClientIds = [...new Set([...entryClientIds, ...invoiceClientIds])];
  if (allClientIds.length === 0) {
    return {
      month,
      clients: [],
      totals: {
        ijpEntries: 0,
        unbilledEntries: 0,
        unattributedEntries: 0,
        clientsWithUnbilled: 0,
        complete: true,
      },
    };
  }

  const [{ byClient: episodesByClient, byId: episodesById }, clientRows] =
    await Promise.all([
      loadClientEpisodes(admin, allClientIds),
      fetchAllPostgrestRowsByIn<{
        id: string;
        full_name: string | null;
        contact_email: string | null;
        user_id: string | null;
        profile_id: string | null;
        archived_at: string | null;
        is_demo: boolean | null;
        current_service_id: string | null;
      }>(
        admin,
        "clients",
        "id, full_name, contact_email, user_id, profile_id, archived_at, is_demo, current_service_id",
        "id",
        allClientIds,
        { order: { column: "id", ascending: true } }
      ),
    ]);

  const profileIds = [
    ...new Set(
      clientRows
        .flatMap((c) => [c.user_id as string | null, c.profile_id as string | null])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const profiles =
    profileIds.length === 0
      ? []
      : await fetchAllPostgrestRowsByIn<{
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>(
          admin,
          "profiles",
          "id, full_name, first_name, last_name",
          "id",
          profileIds,
          { order: { column: "id", ascending: true } }
        );
  const profileById = new Map(profiles.map((p) => [p.id as string, p]));
  const clientById = new Map(clientRows.map((c) => [c.id as string, c]));

  const invoiceById = new Map(invoices.map((inv) => [inv.id as string, inv]));
  const invoicesByClient = new Map<string, IjpLedgerInvoiceSummary[]>();
  for (const inv of invoices) {
    const lines = Array.isArray(inv.line_items) ? inv.line_items : [];
    const hours = Number(inv.total_hours) || 0;
    const summary: IjpLedgerInvoiceSummary = {
      id: inv.id as string,
      providerInvoiceNumber: inv.provider_invoice_number,
      totalHours: hours,
      compiledAt: inv.compiled_at,
      needsRebuild: Boolean(inv.needs_rebuild),
      missingAttestation: Boolean(inv.missing_attestation),
      isEmpty: hours <= 0 && lines.length === 0,
    };
    const list = invoicesByClient.get(inv.client_id as string) ?? [];
    list.push(summary);
    invoicesByClient.set(inv.client_id as string, list);
  }

  const attByClient = new Map(
    attestations.map((a) => [a.client_id as string, a])
  );

  const entriesByClient: Record<string, typeof entries> = {};
  for (const row of entries) {
    const clientId = row.client_id as string;
    if (!clientId) continue;
    const list = entriesByClient[clientId] ?? [];
    list.push(row);
    entriesByClient[clientId] = list;
  }

  const out: IjpLedgerClientGroup[] = [];
  let ijpEntries = 0;
  let unbilledEntries = 0;
  let unattributedEntries = 0;
  let clientsWithUnbilled = 0;

  for (const clientId of allClientIds) {
    const client = clientById.get(clientId);
    if (!client || client.is_demo === true) continue;

    const profile =
      profileById.get((client.user_id as string) ?? "") ??
      profileById.get((client.profile_id as string) ?? "") ??
      null;
    const displayName = clientDisplayNameFromRosterAndProfile(client, profile);
    const sort = clientNameSortKey({
      displayName,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
    });

    const currentServiceId = (client.current_service_id as string | null) ?? null;
    const partitioned = partitionBillableEntriesByIjpAttribution(
      entriesByClient[clientId] ?? [],
      {
        clientEpisodes: episodesByClient[clientId] ?? [],
        ijpServiceIds,
        episodesById,
        currentServiceId,
      }
    );

    type LedgerSourceRow = BillableTimeEntryRow & {
      id: string;
      client_id: string;
      ijp_billed_invoice_id?: string | null;
    };

    const toLedgerEntry = (
      row: LedgerSourceRow,
      attribution: "ijp" | "unattributed"
    ): IjpLedgerEntryRow => {
      const invoiceId = row.ijp_billed_invoice_id ?? null;
      const inv = invoiceId ? invoiceById.get(invoiceId) : null;
      const activity = activityFromRow(row);
      const minutes = Number(row.duration_minutes) || 0;
      return {
        entryId: row.id,
        clientId,
        serviceDate: ((row.service_date as string) ?? "").slice(0, 10),
        durationMinutes: minutes,
        hours: Math.round((minutes / 60) * 100) / 100,
        activityCode: activity.code,
        activityLabel: activity.label,
        billed: Boolean(invoiceId),
        invoiceId,
        providerInvoiceNumber: inv?.provider_invoice_number ?? null,
        attribution,
      };
    };

    const ijpLedger = (partitioned.ijp as LedgerSourceRow[]).map((r) =>
      toLedgerEntry(r, "ijp")
    );
    const unattrLedger = (partitioned.unattributed as LedgerSourceRow[]).map((r) =>
      toLedgerEntry(r, "unattributed")
    );

    if (ijpLedger.length === 0 && unattrLedger.length === 0 && !(invoicesByClient.get(clientId)?.length)) {
      continue;
    }

    const unbilled = ijpLedger.filter((e) => !e.billed);
    ijpEntries += ijpLedger.length;
    unbilledEntries += unbilled.length;
    unattributedEntries += unattrLedger.length;
    if (unbilled.length > 0) clientsWithUnbilled += 1;

    const att = attByClient.get(clientId);
    const hasAttestation = Boolean(att?.attestation_drive_file_id);

    // Live missing_attestation for display (prefer live Drive file over stale invoice flag).
    const clientInvoices = (invoicesByClient.get(clientId) ?? []).map((inv) => ({
      ...inv,
      missingAttestation: !hasAttestation,
    }));

    out.push({
      clientId,
      clientName: displayName,
      archived: Boolean(client.archived_at),
      sortLastName: sort.lastName,
      sortFirstName: sort.firstName,
      ijpHours: sumBillableHoursFromEntries(partitioned.ijp),
      unbilledHours: sumBillableHoursFromEntries(
        partitioned.ijp.filter(
          (r) => !(r as { ijp_billed_invoice_id?: string | null }).ijp_billed_invoice_id
        )
      ),
      unattributedHours: sumBillableHoursFromEntries(partitioned.unattributed),
      attestation: {
        hasAttestation,
        capturedAt: att?.captured_at ?? null,
        driveFileId: att?.attestation_drive_file_id ?? null,
        driveFileName: att?.attestation_drive_file_name ?? null,
        driveUrl: driveFileUrl(att?.attestation_drive_file_id),
      },
      invoices: clientInvoices,
      entries: ijpLedger,
      unattributedEntries: unattrLedger,
    });
  }

  out.sort((a, b) =>
    compareClientNameSortKeys(
      {
        lastName: a.sortLastName,
        firstName: a.sortFirstName,
        displayName: a.clientName,
      },
      {
        lastName: b.sortLastName,
        firstName: b.sortFirstName,
        displayName: b.clientName,
      }
    )
  );

  return {
    month,
    clients: out,
    totals: {
      ijpEntries,
      unbilledEntries,
      unattributedEntries,
      clientsWithUnbilled,
      complete: unbilledEntries === 0,
    },
  };
}

/** Pure helper exported for tests — prefer prior month while its grace window is open. */
export function preferAttestationServiceMonth(opts: {
  nowYmd: string;
  currentMonthStart: string;
  priorMonthStart: string;
  priorWindowOpen: boolean;
  currentWindowOpen: boolean;
  onIjpInPrior: boolean;
  onIjpInCurrent: boolean;
}): string | null {
  if (opts.priorWindowOpen && opts.onIjpInPrior) return opts.priorMonthStart;
  if (opts.currentWindowOpen && opts.onIjpInCurrent) return opts.currentMonthStart;
  if (opts.onIjpInCurrent) return opts.currentMonthStart;
  if (opts.onIjpInPrior) return opts.priorMonthStart;
  void opts.nowYmd;
  return null;
}

export { classifyIjpTimeEntryAttribution };
