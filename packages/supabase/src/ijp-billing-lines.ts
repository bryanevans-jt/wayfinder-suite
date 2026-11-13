import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  formatBillableHours,
  type ClientBillableEntry,
} from "./client-billable";
import { serviceMonthStartFromYmd } from "./ijp-billing-eligibility";
import { formatServiceTimeOfDay } from "./es-time-tracking";
import { serviceMonthEndYmd } from "./ijp-billing-eligibility";
import { formatIjpInvoiceAmount, formatIjpRateDollars } from "./ijp-billing-settings";

/** GVRA IJP vocational invoice service code on every line. */
export const IJP_INVOICE_SERVICE_CODE = "00270";

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

/**
 * Service Description on IJP invoice lines: contact-log / activity type name only
 * (e.g. "In-Person Meeting", "Job Canvassing") — no notes or outcome text.
 */
export function ijpLineServiceDescription(
  activityName: string | null | undefined
): string {
  return (activityName ?? "").trim();
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
    | { code?: string; name?: string; counts_toward_client_billable?: boolean }
    | { code?: string; name?: string; counts_toward_client_billable?: boolean }[]
    | null
): { code?: string; name?: string; counts_toward_client_billable?: boolean } | null {
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
      `id, es_user_id, service_date, duration_minutes, service_start_at, service_end_at,
       flags, client_present, delivery_mode, status,
       service_activity_types ( code, name, counts_toward_client_billable )`
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

    const description = ijpLineServiceDescription(activity?.name);
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
      serviceCode: IJP_INVOICE_SERVICE_CODE,
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

/**
 * Round hours UP to the next whole hour for invoice / packet totals.
 * Exact whole hours stay the same (3.0 → 3). Null / NaN / negative → 0.
 * Line-item hours are not modified by this helper — only totals.
 */
export function ceilIjpTotalHours(hours: number | null | undefined): number {
  if (hours == null) return 0;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Line hours are stored at one decimal; snap before ceil to avoid FP false ups.
  const oneDecimal = Math.round(n * 10) / 10;
  return Math.ceil(oneDecimal);
}

/**
 * Sum line items into invoice totals.
 * - Preserves per-line `hours` / `amountCents` as-is on the lines themselves.
 * - `totalHours` is the ceiled sum of line hours (whole hours).
 * - When `hourlyRateCents` is provided, `totalAmountCents` is billed from the
 *   ceiled hours so PDF/header totals agree with the billed hour total.
 * - Without a rate, amount falls back to the sum of line amounts.
 */
export function sumIjpLineItems(
  lines: IjpInvoiceLineItem[],
  hourlyRateCents?: number | null
): {
  totalHours: number;
  totalAmountCents: number;
} {
  let rawHours = 0;
  let lineAmountSum = 0;
  for (const line of lines ?? []) {
    rawHours += Number(line?.hours) || 0;
    lineAmountSum += Number(line?.amountCents) || 0;
  }
  const totalHours = ceilIjpTotalHours(rawHours);
  const rate =
    hourlyRateCents == null || !Number.isFinite(Number(hourlyRateCents))
      ? null
      : Number(hourlyRateCents);
  return {
    totalHours,
    totalAmountCents:
      rate == null ? lineAmountSum : Math.round(totalHours * rate),
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
    TotalHours: Number.isInteger(opts.totalHours)
      ? String(opts.totalHours)
      : opts.totalHours.toFixed(1),
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
