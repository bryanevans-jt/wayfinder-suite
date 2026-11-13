import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  type ClientBillableEntry,
} from "./client-billable";
import { serviceMonthStartFromYmd } from "./ijp-billing-eligibility";
import { formatServiceTimeOfDay } from "./es-time-tracking";
import { serviceMonthEndYmd } from "./ijp-billing-eligibility";
import { formatIjpInvoiceAmount, formatIjpRateDollars } from "./ijp-billing-settings";

/** GVRA IJP vocational invoice service code on every line. */
export const IJP_INVOICE_SERVICE_CODE = "00270";

/**
 * Round positive values half-up (away from zero at .5).
 * Matches JavaScript `Math.round` for non-negative inputs — documented so callers
 * do not assume banker's rounding.
 */
function roundHalfUp(n: number): number {
  return Math.floor(n + 0.5);
}

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
  /**
   * Set when an editor saves line hours via PATCH. Auto-refresh skips invoices
   * that still carry this flag so manual adjustments are not overwritten.
   * Cleared on the next billable-time sync (rebuild replaces the line objects).
   */
  manuallyAdjusted?: boolean;
};

/**
 * Round billable minutes to the nearest half hour (0.5 hr / 30 min), round-half-up.
 * Examples: 75 → 1.5, 70 → 1.0, 105 → 2.0, 45 → 1.0, 15 → 0.5, 14 → 0.
 */
export function roundIjpLineHoursFromMinutes(minutes: number | null | undefined): number {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return 0;
  return roundHalfUp(m / 30) * 0.5;
}

/**
 * Snap a line-hour input to the nearest half hour (round-half-up).
 * Used for manual edits in the billing UI / PATCH path.
 */
export function roundIjpLineHours(hours: number | null | undefined): number {
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0) return 0;
  return roundHalfUp(h * 2) * 0.5;
}

/** True when any stored line was saved from a manual hours edit. */
export function invoiceLinesAreManuallyAdjusted(
  lines: Array<Pick<IjpInvoiceLineItem, "manuallyAdjusted"> | null | undefined> | null | undefined
): boolean {
  return (lines ?? []).some((line) => line?.manuallyAdjusted === true);
}

/** Mark lines as manually adjusted after an editor saves hours. */
export function markIjpLinesManuallyAdjusted(lines: IjpInvoiceLineItem[]): IjpInvoiceLineItem[] {
  return (lines ?? []).map((line) => ({
    ...line,
    hours: roundIjpLineHours(line.hours),
    manuallyAdjusted: true,
  }));
}

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
    const hours = roundIjpLineHoursFromMinutes(minutes);
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
      hours,
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
 * Line hours are half-hour increments; snap to 0.5 before ceil to avoid FP noise.
 */
export function ceilIjpTotalHours(hours: number | null | undefined): number {
  if (hours == null) return 0;
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const halfHour = Math.round(n * 2) / 2;
  return Math.ceil(halfHour);
}

/**
 * Sum line items into invoice totals.
 * - Preserves per-line `hours` / `amountCents` as-is on the lines themselves
 *   (callers should already snap line hours to half hours).
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
  const hours = roundIjpLineHours(line.hours);
  return {
    ...line,
    hours,
    amountCents: Math.round(hours * hourlyRateCents),
  };
}

/** Draft / non-compiled / non-archived invoices are eligible for billable-line auto-refresh. */
export function isIjpInvoiceEligibleForDraftLineRefresh(invoice: {
  status?: string | null;
  compiled_at?: string | null;
  archived_at?: string | null;
  line_items?: Array<Pick<IjpInvoiceLineItem, "manuallyAdjusted"> | null | undefined> | null;
}): boolean {
  if ((invoice.status ?? "draft") !== "draft") return false;
  if (invoice.compiled_at) return false;
  if (invoice.archived_at) return false;
  if (invoiceLinesAreManuallyAdjusted(invoice.line_items)) return false;
  return true;
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
