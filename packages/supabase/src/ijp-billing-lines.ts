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

const IJP_INVOICE_DESCRIPTION_MAX_LINES = 5;
/** Target characters per line for the invoice table description column (Google Doc PDF). */
const IJP_INVOICE_DESCRIPTION_CHARS_PER_LINE = 46;

/**
 * Formats service description for the invoice PDF table only (max five visible lines + "...").
 * Inserts explicit line breaks so Google Docs does not wrap one long paragraph past five lines.
 */
export function truncateIjpLineDescription(
  text: string,
  maxLines = IJP_INVOICE_DESCRIPTION_MAX_LINES,
  charsPerLine = IJP_INVOICE_DESCRIPTION_CHARS_PER_LINE
): string {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!normalized) return "";

  const lines: string[] = [];
  let remaining = normalized;
  /** Do not break on a space too early (e.g. lone "Contact" before a long clause). */
  const minBreakAtSpace = Math.max(12, Math.floor(charsPerLine * 0.55));

  while (remaining && lines.length < maxLines) {
    if (remaining.length <= charsPerLine) {
      lines.push(remaining);
      remaining = "";
      break;
    }
    const windowEnd = Math.min(charsPerLine, remaining.length);
    let breakAt = remaining.lastIndexOf(" ", windowEnd);
    if (breakAt <= 0 || breakAt < minBreakAtSpace) {
      breakAt = windowEnd;
    }
    lines.push(remaining.slice(0, breakAt).trimEnd());
    remaining = remaining.slice(breakAt).trimStart();
  }

  if (remaining) {
    const lastIndex = maxLines - 1;
    const last = lines[lastIndex] ?? "";
    const room = Math.max(1, charsPerLine - 3);
    lines[lastIndex] = `${(last.length > room ? last.slice(0, room).trimEnd() : last)}...`;
  }

  return lines.join("\n");
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
