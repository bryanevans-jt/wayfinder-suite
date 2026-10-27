import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClientActivityFeedItem } from "@wayfinder/branding";
import { buildClientActivityFeed } from "@wayfinder/branding";
import {
  entryCountsTowardClientBillableWithActivity,
  formatBillableHours,
  type ClientBillableEntry,
} from "./client-billable";
import { serviceMonthStartFromYmd } from "./ijp-billing-eligibility";
import { formatServiceTimeOfDay } from "./es-time-tracking";
import { serviceMonthEndYmd } from "./ijp-billing-eligibility";
import { formatIjpInvoiceAmount, formatIjpRateDollars } from "./ijp-billing-settings";

const IJP_LINE_DESCRIPTION_MAX_LINES = 5;
/** Approx. characters per line in the invoice table description column (Google Doc). */
const IJP_LINE_DESCRIPTION_CHARS_PER_LINE = 52;

export function truncateIjpLineDescription(
  text: string,
  maxLines = IJP_LINE_DESCRIPTION_MAX_LINES
): string {
  const trimmed = text.replace(/\r\n/g, "\n").trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split("\n");
  if (parts.length > maxLines) {
    return `${parts.slice(0, maxLines).join("\n")}\n...`;
  }

  if (parts.length === 1) {
    const maxChars = IJP_LINE_DESCRIPTION_CHARS_PER_LINE * maxLines;
    if (parts[0].length > maxChars) {
      return `${parts[0].slice(0, maxChars).trimEnd()}...`;
    }
  }

  return trimmed;
}

export type IjpInvoiceLineItem = {
  entryId: string;
  authorization: string;
  serviceCode: string;
  description: string;
  serviceDate: string;
  startTime: string;
  endTime: string;
  hours: number;
  amountCents: number;
  instructorName: string;
  editable: boolean;
};

export function activityFeedItemSummary(item: ClientActivityFeedItem): string {
  if (item.kind === "contact") {
    const parts = [item.public_outcome?.trim(), item.notes?.trim()].filter(Boolean);
    return parts.join(" — ") || "Contact log";
  }
  if (item.kind === "milestone") {
    return `Milestone: ${item.title}`;
  }
  if (item.kind === "application") {
    const co = item.company_name?.trim() || "Employer";
    return `Application: ${co} (${item.status?.trim() || "—"})`;
  }
  return `Meeting: ${item.service_name?.trim() || "Wayfinder service"}`;
}

function findFeedItemForContact(
  feed: ClientActivityFeedItem[],
  contactLogId: string
): ClientActivityFeedItem | null {
  return feed.find((f) => f.kind === "contact" && f.id === contactLogId) ?? null;
}

export type IjpInvoiceLineBuildResult = {
  lines: IjpInvoiceLineItem[];
  /** Non-rejected ES time entries in the service month (matches timesheet visibility). */
  entryCount: number;
  /** Entries that count toward client billable hours (activity + flags). */
  billableEntryCount: number;
};

function parseActivityEmbed(
  embed:
    | { code?: string; counts_toward_client_billable?: boolean }
    | { code?: string; counts_toward_client_billable?: boolean }[]
    | null
): { code?: string; counts_toward_client_billable?: boolean } | null {
  if (!embed) return null;
  return Array.isArray(embed) ? embed[0] ?? null : embed;
}

export async function buildIjpInvoiceLineItems(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    monthStart: string;
    authorizationNumber: string;
    hourlyRateCents: number;
    esNameByUserId: Map<string, string>;
  }
): Promise<IjpInvoiceLineBuildResult> {
  const monthStart = serviceMonthStartFromYmd(opts.monthStart);
  const monthEnd = serviceMonthEndYmd(monthStart);
  const { data: entries, error } = await admin
    .from("es_time_entries")
    .select(
      `id, es_user_id, service_date, duration_minutes, narrative, service_start_at, service_end_at,
       linked_source_type, linked_source_id, flags, client_present, delivery_mode, status,
       service_activity_types ( code, counts_toward_client_billable )`
    )
    .eq("client_id", opts.clientId)
    .neq("status", "rejected")
    .gte("service_date", monthStart)
    .lte("service_date", monthEnd)
    .order("service_date", { ascending: true })
    .order("service_start_at", { ascending: true, nullsFirst: true });

  if (error) {
    throw new Error(error.message);
  }

  const contactIds = (entries ?? [])
    .filter((e) => e.linked_source_type === "contact_log" && e.linked_source_id)
    .map((e) => e.linked_source_id as string);

  let feed: ClientActivityFeedItem[] = [];
  if (contactIds.length > 0) {
    const { data: logs } = await admin
      .from("contact_logs")
      .select("id, created_at, public_outcome, notes, logged_by")
      .in("id", contactIds);
    feed = buildClientActivityFeed({
      logs: (logs ?? []) as Parameters<typeof buildClientActivityFeed>[0]["logs"],
    });
  }

  const lines: IjpInvoiceLineItem[] = [];
  let billableEntryCount = 0;

  for (const row of entries ?? []) {
    const activity = parseActivityEmbed(
      row.service_activity_types as Parameters<typeof parseActivityEmbed>[0]
    );
    const billable = entryCountsTowardClientBillableWithActivity(
      row as ClientBillableEntry,
      activity
    );
    const minutes = billable ? (row.duration_minutes as number) || 0 : 0;
    if (billable && minutes > 0) billableEntryCount += 1;
    const hours = minutes / 60;
    const amountCents = Math.round(hours * opts.hourlyRateCents);

    let description = (row.narrative as string)?.trim() ?? "";
    if (row.linked_source_type === "contact_log" && row.linked_source_id) {
      const item = findFeedItemForContact(feed, row.linked_source_id as string);
      if (item) description = activityFeedItemSummary(item);
    }
    if (!description) {
      description = "Billable service";
    }
    description = truncateIjpLineDescription(description);

    let startTime = "";
    let endTime = "";
    if (row.service_start_at && row.service_end_at) {
      startTime = formatServiceTimeOfDay(row.service_start_at as string);
      endTime = formatServiceTimeOfDay(row.service_end_at as string);
    } else if ((row.flags as Record<string, boolean>)?.gvra_monthly_admin_allowance) {
      startTime = "—";
      endTime = "—";
    }

    const esUserId = row.es_user_id as string;
    lines.push({
      entryId: row.id as string,
      authorization: opts.authorizationNumber,
      serviceCode: "IJP",
      description,
      serviceDate: row.service_date as string,
      startTime,
      endTime,
      hours: Number(formatBillableHours(minutes)),
      amountCents,
      instructorName: opts.esNameByUserId.get(esUserId) ?? "—",
      editable: true,
    });
  }

  return {
    lines,
    entryCount: entries?.length ?? 0,
    billableEntryCount,
  };
}

export function sumIjpLineItems(lines: IjpInvoiceLineItem[]): {
  totalHours: number;
  totalAmountCents: number;
} {
  let totalHours = 0;
  let totalAmountCents = 0;
  for (const line of lines) {
    totalHours += line.hours;
    totalAmountCents += line.amountCents;
  }
  return {
    totalHours: Math.round(totalHours * 10) / 10,
    totalAmountCents,
  };
}

export function recalcLineAmount(line: IjpInvoiceLineItem, hourlyRateCents: number): IjpInvoiceLineItem {
  return {
    ...line,
    amountCents: Math.round(line.hours * hourlyRateCents),
  };
}

export function buildIjpInvoiceHeaderPlaceholders(opts: {
  invoiceDate: string;
  providerName: string;
  remitAddress: string;
  providerInvoiceNumber: string;
  authorizationNumber: string;
  clientName: string;
  serviceMonth: string;
  serviceMonthLabel: string;
  hourlyRateCents: number;
  totalHours: number;
  totalAmountCents: number;
  instructorFacilitatorSummary: string;
}): Record<string, string> {
  return {
    InvoiceDate: opts.invoiceDate,
    ProviderName: opts.providerName,
    RemitAddress: opts.remitAddress,
    ProviderInvoiceNumber: opts.providerInvoiceNumber,
    InvoiceNumber: opts.providerInvoiceNumber,
    AuthorizationNumber: opts.authorizationNumber,
    AuthNumber: opts.authorizationNumber,
    ClientName: opts.clientName,
    ServiceMonth: opts.serviceMonthLabel,
    IndividualMark: "☑",
    GroupMark: "☐",
    AuthTypeIndividual: "☑",
    AuthTypeGroup: "☐",
    TotalHours: opts.totalHours.toFixed(1),
    TotalAmount: formatIjpInvoiceAmount(opts.totalAmountCents),
    RateDollars: formatIjpRateDollars(opts.hourlyRateCents),
    InstructorFacilitatorName: opts.instructorFacilitatorSummary,
  };
}

export function buildIjpAttestationPlaceholders(opts: {
  attestationProviderName: string;
  providerInvoiceNumber: string;
  authorizationNumber: string;
  attestationDate: string;
}): Record<string, string> {
  return {
    AttestationProviderName: opts.attestationProviderName,
    ProviderInvoiceNumber: opts.providerInvoiceNumber,
    InvoiceNumber: opts.providerInvoiceNumber,
    AuthorizationNumber: opts.authorizationNumber,
    AuthNumber: opts.authorizationNumber,
    AttestationDate: opts.attestationDate,
  };
}
