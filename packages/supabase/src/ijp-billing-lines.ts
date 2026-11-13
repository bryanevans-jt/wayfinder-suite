import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  type ClientBillableEntry,
} from "./client-billable";
import { entryEligibleForIjpInvoiceBuild } from "./ijp-billing-entry-billing";
import {
  serviceMonthEndYmd,
  serviceMonthStartFromYmd,
  timeEntryAttributedToIjpService,
  type IjpAttributionEpisode,
} from "./ijp-billing-eligibility";
import { formatServiceTimeOfDay } from "./es-time-tracking";
import { resolveGaIjpServiceIds, formatIjpInvoiceAmount, formatIjpRateDollars } from "./ijp-billing-settings";

/** GVRA IJP vocational invoice service code on every line. */
export const IJP_INVOICE_SERVICE_CODE = "00270";

/** Hours granted for the monthly GVRA Reports / paperwork allotment. */
export const IJP_GVRA_ALLOWANCE_HOURS = 2;

/** Invoice description for the GVRA Reports allotment line. */
export const IJP_GVRA_ALLOWANCE_DESCRIPTION = "GVRA monthly report and paperwork allowance";

/**
 * Where an invoice line came from.
 * - billable: synced from an ES time / contact-linked entry
 * - gvra_allowance: the monthly 2-hour Reports allotment (ES-backed or synthetic)
 * - manual: invoice-only; never creates contact logs or es_time_entries
 */
export type IjpInvoiceLineSource = "billable" | "gvra_allowance" | "manual";

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
   * Origin of the line. Manual lines are invoice-only and survive billable sync.
   * Defaults to billable when omitted (legacy rows).
   */
  source?: IjpInvoiceLineSource;
  /**
   * Set when an editor overrides hours on a billable/gvra line via PATCH.
   * Sync keeps those hours for the matching entryId; it does not skip the invoice.
   */
  manuallyAdjusted?: boolean;
};

/** Stable synthetic id for a month's GVRA allowance when no ES entry exists yet. */
export function ijpGvraAllowanceEntryId(clientId: string, monthStart: string): string {
  return `gvra-allowance:${clientId}:${serviceMonthStartFromYmd(monthStart)}`;
}

export function newManualIjpLineEntryId(): string {
  return `manual:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

export function isManualIjpLine(
  line: Pick<IjpInvoiceLineItem, "source" | "entryId"> | null | undefined
): boolean {
  if (!line) return false;
  if (line.source === "manual") return true;
  return typeof line.entryId === "string" && line.entryId.startsWith("manual:");
}

export function isGvraAllowanceIjpLine(
  line: Pick<IjpInvoiceLineItem, "source" | "entryId"> | null | undefined
): boolean {
  if (!line) return false;
  if (line.source === "gvra_allowance") return true;
  return typeof line.entryId === "string" && line.entryId.startsWith("gvra-allowance:");
}

/** Build an invoice-only manual line (never writes contact logs / ES time). */
export function createManualIjpInvoiceLine(opts: {
  serviceDate: string;
  description: string;
  hours: number;
  authorization?: string;
  hourlyRateCents: number;
  startTime?: string;
  endTime?: string;
  instructorName?: string;
  entryId?: string;
}): IjpInvoiceLineItem {
  const hours = roundIjpLineHours(opts.hours);
  return {
    entryId: opts.entryId ?? newManualIjpLineEntryId(),
    authorization: opts.authorization ?? "",
    serviceCode: IJP_INVOICE_SERVICE_CODE,
    description: ijpLineServiceDescription(opts.description),
    serviceDate: opts.serviceDate,
    startTime: (opts.startTime ?? "").trim(),
    endTime: (opts.endTime ?? "").trim(),
    hours,
    amountCents: Math.round(hours * opts.hourlyRateCents),
    instructorName: (opts.instructorName ?? "—").trim() || "—",
    editable: true,
    source: "manual",
  };
}

/** Synthetic 2-hour Reports allotment dated the last day of the service month. */
export function createGvraAllowanceIjpInvoiceLine(opts: {
  clientId: string;
  monthStart: string;
  authorization?: string;
  hourlyRateCents: number;
  instructorName?: string;
}): IjpInvoiceLineItem {
  const monthStart = serviceMonthStartFromYmd(opts.monthStart);
  const hours = IJP_GVRA_ALLOWANCE_HOURS;
  return {
    entryId: ijpGvraAllowanceEntryId(opts.clientId, monthStart),
    authorization: opts.authorization ?? "",
    serviceCode: IJP_INVOICE_SERVICE_CODE,
    description: IJP_GVRA_ALLOWANCE_DESCRIPTION,
    serviceDate: serviceMonthEndYmd(monthStart),
    startTime: "—",
    endTime: "—",
    hours,
    amountCents: Math.round(hours * opts.hourlyRateCents),
    instructorName: (opts.instructorName ?? "—").trim() || "—",
    editable: true,
    source: "gvra_allowance",
  };
}

/**
 * Keep at most one GVRA allowance line. Prefer an ES-backed allowance over a
 * synthetic one. If none exist, append a synthetic last-day-of-month line.
 */
export function ensureSingleGvraAllowanceLine(
  lines: IjpInvoiceLineItem[],
  opts: {
    clientId: string;
    monthStart: string;
    authorization?: string;
    hourlyRateCents: number;
    instructorName?: string;
  }
): IjpInvoiceLineItem[] {
  const monthStart = serviceMonthStartFromYmd(opts.monthStart);
  const gvra: IjpInvoiceLineItem[] = [];
  const rest: IjpInvoiceLineItem[] = [];
  for (const line of lines ?? []) {
    if (isGvraAllowanceIjpLine(line)) gvra.push({ ...line, source: "gvra_allowance" });
    else rest.push(line);
  }

  let chosen: IjpInvoiceLineItem | null = null;
  for (const line of gvra) {
    if (!line.entryId.startsWith("gvra-allowance:")) {
      chosen = {
        ...line,
        source: "gvra_allowance",
        hours: roundIjpLineHours(line.hours) || IJP_GVRA_ALLOWANCE_HOURS,
        serviceCode: IJP_INVOICE_SERVICE_CODE,
        description: IJP_GVRA_ALLOWANCE_DESCRIPTION,
        startTime: line.startTime || "—",
        endTime: line.endTime || "—",
      };
      chosen.amountCents = Math.round(chosen.hours * opts.hourlyRateCents);
      break;
    }
  }
  if (!chosen && gvra[0]) {
    chosen = {
      ...gvra[0],
      source: "gvra_allowance",
      entryId: ijpGvraAllowanceEntryId(opts.clientId, monthStart),
      hours: roundIjpLineHours(gvra[0].hours) || IJP_GVRA_ALLOWANCE_HOURS,
      serviceDate: serviceMonthEndYmd(monthStart),
      serviceCode: IJP_INVOICE_SERVICE_CODE,
      description: IJP_GVRA_ALLOWANCE_DESCRIPTION,
      startTime: "—",
      endTime: "—",
    };
    chosen.amountCents = Math.round(chosen.hours * opts.hourlyRateCents);
  }
  if (!chosen) {
    chosen = createGvraAllowanceIjpInvoiceLine(opts);
  }

  return [...rest, chosen];
}

/**
 * Merge freshly built billable/gvra lines with prior invoice lines.
 * Preserves invoice-only manual lines and hour overrides on matching entryIds.
 */
export function mergeIjpInvoiceLinesWithManual(
  builtLines: IjpInvoiceLineItem[],
  existingLines: IjpInvoiceLineItem[] | null | undefined
): IjpInvoiceLineItem[] {
  const existing = existingLines ?? [];
  const existingById = new Map(existing.map((line) => [line.entryId, line]));
  const mergedBuilt: IjpInvoiceLineItem[] = [];

  for (const built of builtLines ?? []) {
    const prev = existingById.get(built.entryId);
    if (prev?.manuallyAdjusted) {
      const hours = roundIjpLineHours(prev.hours);
      mergedBuilt.push({
        ...built,
        hours,
        amountCents: prev.amountCents,
        manuallyAdjusted: true,
        description: prev.description || built.description,
        startTime: prev.startTime || built.startTime,
        endTime: prev.endTime || built.endTime,
        source: built.source ?? prev.source ?? "billable",
      });
    } else {
      mergedBuilt.push({
        ...built,
        source: built.source ?? (isGvraAllowanceIjpLine(built) ? "gvra_allowance" : "billable"),
      });
    }
  }

  const builtIds = new Set(mergedBuilt.map((line) => line.entryId));
  const manuals = existing.filter(
    (line) => isManualIjpLine(line) && !builtIds.has(line.entryId)
  ).map((line) => ({
    ...line,
    source: "manual" as const,
    serviceCode: IJP_INVOICE_SERVICE_CODE,
    hours: roundIjpLineHours(line.hours),
  }));

  return [...mergedBuilt, ...manuals];
}

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

/**
 * Normalize lines after an editor PATCH: snap hours, keep source markers, and
 * flag non-manual lines as manuallyAdjusted so sync preserves hour overrides.
 */
export function markIjpLinesManuallyAdjusted(lines: IjpInvoiceLineItem[]): IjpInvoiceLineItem[] {
  return (lines ?? []).map((line) => {
    const hours = roundIjpLineHours(line.hours);
    if (isManualIjpLine(line)) {
      return {
        ...line,
        hours,
        source: "manual" as const,
        serviceCode: IJP_INVOICE_SERVICE_CODE,
        manuallyAdjusted: undefined,
      };
    }
    if (isGvraAllowanceIjpLine(line)) {
      return {
        ...line,
        hours,
        source: "gvra_allowance" as const,
        serviceCode: IJP_INVOICE_SERVICE_CODE,
        manuallyAdjusted: true,
      };
    }
    return {
      ...line,
      hours,
      source: line.source ?? "billable",
      serviceCode: IJP_INVOICE_SERVICE_CODE,
      manuallyAdjusted: true,
    };
  });
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
    /** When set, include only unbilled entries plus entries already billed on this invoice. */
    invoiceId?: string | null;
    /** When true (default), exclude entries billed on a different invoice. */
    excludeBilledOnOtherInvoices?: boolean;
  }
): Promise<IjpInvoiceLineBuildResult> {
  const monthStart = serviceMonthStartFromYmd(opts.monthStart);
  const monthEnd = serviceMonthEndYmd(monthStart);
  const ijpServiceIds = await resolveGaIjpServiceIds(admin);
  const { data: entries, error } = await admin
    .from("es_time_entries")
    .select(
      `id, es_user_id, service_date, duration_minutes, service_start_at, service_end_at,
       flags, client_present, delivery_mode, status, ijp_billed_invoice_id, service_episode_id,
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

  const { data: episodeRows } = await admin
    .from("service_episodes")
    .select("id, service_id, started_at, ended_at")
    .eq("client_id", opts.clientId);
  const clientEpisodes = (episodeRows ?? []) as IjpAttributionEpisode[];
  const episodesById = new Map(
    clientEpisodes
      .filter((ep) => ep.id)
      .map((ep) => [ep.id as string, ep])
  );
  // IJP invoices include only hours attributable to IJP (entry episode service, or
  // IJP episode covering the service_date when the entry has no episode link).
  const attributedRows = (entries ?? []).filter((row) => {
    const episodeId = (row.service_episode_id as string | null) ?? null;
    return timeEntryAttributedToIjpService({
      serviceDate: row.service_date as string,
      serviceEpisodeId: episodeId,
      entryEpisode: episodeId ? episodesById.get(episodeId) ?? null : null,
      clientEpisodes,
      ijpServiceIds,
    });
  });

  const excludeOther = opts.excludeBilledOnOtherInvoices !== false;
  const lines: IjpInvoiceLineItem[] = [];
  let billableEntryCount = 0;
  let entryCount = 0;

  for (const row of attributedRows) {
    if (
      excludeOther &&
      !entryEligibleForIjpInvoiceBuild(
        {
          id: row.id as string,
          ijp_billed_invoice_id: row.ijp_billed_invoice_id as string | null,
        },
        opts.invoiceId
      )
    ) {
      continue;
    }
    entryCount += 1;
    const activity = parseActivityEmbed(
      row.service_activity_types as Parameters<typeof parseActivityEmbed>[0]
    );
    const flags = (row.flags as Record<string, boolean> | null) ?? {};
    const isGvra = flags.gvra_monthly_admin_allowance === true;
    const billable = entryCountsTowardClientBillableWithActivity(
      row as ClientBillableEntry,
      activity
    );
    const minutes = billable ? (row.duration_minutes as number) || 0 : 0;
    if (billable && minutes > 0) billableEntryCount += 1;
    const hours = roundIjpLineHoursFromMinutes(minutes);
    const amountCents = Math.round(hours * opts.hourlyRateCents);

    const description = isGvra
      ? IJP_GVRA_ALLOWANCE_DESCRIPTION
      : ijpLineServiceDescription(activity?.name);
    let startTime = "";
    let endTime = "";
    if (row.service_start_at && row.service_end_at) {
      startTime = formatServiceTimeOfDay(row.service_start_at as string);
      endTime = formatServiceTimeOfDay(row.service_end_at as string);
    } else if (isGvra) {
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
      source: isGvra ? "gvra_allowance" : "billable",
    });
  }

  return {
    lines,
    entryCount,
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

/**
 * Draft / non-compiled / non-archived invoices are eligible for billable-line
 * auto-refresh. Manual invoice-only lines and hour overrides are preserved by
 * mergeIjpInvoiceLinesWithManual — they no longer block refresh.
 */
export function isIjpInvoiceEligibleForDraftLineRefresh(invoice: {
  status?: string | null;
  compiled_at?: string | null;
  archived_at?: string | null;
  line_items?: Array<Pick<IjpInvoiceLineItem, "manuallyAdjusted" | "source" | "entryId"> | null | undefined> | null;
}): boolean {
  void invoice.line_items;
  if ((invoice.status ?? "draft") !== "draft") return false;
  if (invoice.compiled_at) return false;
  if (invoice.archived_at) return false;
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
