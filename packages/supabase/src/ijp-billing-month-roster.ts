/**
 * IJP Billing month roster: every client with IJP-attributed activity in the
 * selected month (invoiced or not), one row per client.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientDisplayNameFromRosterAndProfile,
  clientNameSortKey,
  compareClientNameSortKeys,
} from "@wayfinder/branding";
import {
  filterIjpAttributedBillableEntries,
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

export type IjpBillingMonthInvoiceSummary = {
  id: string;
  status: string;
  provider_invoice_number: string | null;
  authorization_number: string | null;
  invoice_date: string | null;
  total_hours: number;
  total_amount_cents: number;
  missing_attestation: boolean;
  compiled_at: string | null;
  archived_at: string | null;
  created_at: string | null;
  hasAttestation: boolean;
};

export type IjpBillingMonthClientRow = {
  clientId: string;
  clientName: string;
  sortLastName: string;
  sortFirstName: string;
  archived: boolean;
  billableIjpHours: number;
  unbilledIjpHours: number;
  /** High-level status for the month list. */
  status:
    | "not_invoiced"
    | "draft"
    | "compiled"
    | "mixed"
    | "archived"
    | "empty_draft";
  invoices: IjpBillingMonthInvoiceSummary[];
};

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

function deriveClientStatus(
  invoices: IjpBillingMonthInvoiceSummary[],
  unbilledHours: number
): IjpBillingMonthClientRow["status"] {
  if (invoices.length === 0) return "not_invoiced";
  if (invoices.every((inv) => inv.archived_at)) return "archived";
  const live = invoices.filter((inv) => !inv.archived_at);
  if (live.length === 0) return "archived";
  const allZero = live.every((inv) => (Number(inv.total_hours) || 0) <= 0);
  if (allZero && unbilledHours > 0) return "empty_draft";
  const anyCompiled = live.some((inv) => inv.compiled_at);
  const anyDraft = live.some((inv) => !inv.compiled_at);
  if (anyCompiled && anyDraft) return "mixed";
  if (anyCompiled) return "compiled";
  return "draft";
}

/**
 * One row per client with IJP-attributed billable activity in the month.
 * Includes clients with no invoice yet. Sorted by last name, then first name.
 */
export async function loadIjpBillingMonthClientRoster(
  admin: SupabaseClient,
  monthStart: string,
  opts?: { isTest?: boolean }
): Promise<{ month: string; clients: IjpBillingMonthClientRow[] }> {
  const month = serviceMonthStartFromYmd(monthStart);
  const monthEnd = serviceMonthEndYmd(month);
  const isTest = opts?.isTest === true;
  const ijpServiceIds = await resolveGaIjpServiceIds(admin);
  if (ijpServiceIds.length === 0) {
    return { month, clients: [] };
  }

  const [entries, invoices] = await Promise.all([
    fetchAllPostgrestRows<
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
      status: string;
      provider_invoice_number: string | null;
      authorization_number: string | null;
      invoice_date: string | null;
      total_hours: number;
      total_amount_cents: number;
      missing_attestation: boolean;
      compiled_at: string | null;
      archived_at: string | null;
      created_at: string | null;
    }>(
      admin,
      "ijp_billing_invoices",
      "id, client_id, status, provider_invoice_number, authorization_number, invoice_date, total_hours, total_amount_cents, missing_attestation, compiled_at, archived_at, created_at",
      {
        order: { column: "created_at", ascending: true },
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
    return { month, clients: [] };
  }

  const [{ byClient: episodesByClient, byId: episodesById }, clientRows, attestations] =
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
      fetchAllPostgrestRows<{
        client_id: string;
        attestation_drive_file_id: string | null;
      }>(
        admin,
        "ijp_monthly_attestations",
        "client_id, attestation_drive_file_id",
        {
          order: { column: "client_id", ascending: true },
          applyFilters: (query) =>
            query.eq("service_month", month).eq("is_test", isTest),
        }
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

  const hasAtt = new Set(
    attestations
      .filter((a) => a.attestation_drive_file_id)
      .map((a) => a.client_id as string)
  );

  const entriesByClient: Record<string, BillableTimeEntryRow[]> = {};
  for (const row of entries) {
    const clientId = row.client_id as string;
    if (!clientId) continue;
    const list = entriesByClient[clientId] ?? [];
    list.push(row);
    entriesByClient[clientId] = list;
  }

  const invoicesByClient = new Map<string, IjpBillingMonthInvoiceSummary[]>();
  for (const inv of invoices) {
    const clientId = inv.client_id as string;
    const list = invoicesByClient.get(clientId) ?? [];
    list.push({
      id: inv.id as string,
      status: (inv.status as string) ?? "draft",
      provider_invoice_number: inv.provider_invoice_number,
      authorization_number: inv.authorization_number,
      invoice_date: inv.invoice_date,
      total_hours: Number(inv.total_hours) || 0,
      total_amount_cents: Number(inv.total_amount_cents) || 0,
      missing_attestation: Boolean(inv.missing_attestation),
      compiled_at: inv.compiled_at,
      archived_at: inv.archived_at,
      created_at: inv.created_at,
      hasAttestation: hasAtt.has(clientId),
    });
    invoicesByClient.set(clientId, list);
  }

  const clientById = new Map(clientRows.map((c) => [c.id as string, c]));
  const out: IjpBillingMonthClientRow[] = [];

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

    const ijpEntries = filterIjpAttributedBillableEntries(
      entriesByClient[clientId] ?? [],
      {
        clientEpisodes: episodesByClient[clientId] ?? [],
        ijpServiceIds,
        episodesById,
        currentServiceId: (client.current_service_id as string | null) ?? null,
      }
    );
    const clientInvoices = invoicesByClient.get(clientId) ?? [];

    // Include clients with IJP activity OR existing invoices for the month.
    if (ijpEntries.length === 0 && clientInvoices.length === 0) continue;

    const unbilledEntries = ijpEntries.filter(
      (row) => !(row as { ijp_billed_invoice_id?: string | null }).ijp_billed_invoice_id
    );

    out.push({
      clientId,
      clientName: displayName,
      sortLastName: sort.lastName,
      sortFirstName: sort.firstName,
      archived: Boolean(client.archived_at),
      billableIjpHours: sumBillableHoursFromEntries(ijpEntries),
      unbilledIjpHours: sumBillableHoursFromEntries(unbilledEntries),
      status: deriveClientStatus(
        clientInvoices,
        sumBillableHoursFromEntries(unbilledEntries)
      ),
      invoices: clientInvoices,
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

  return { month, clients: out };
}
