export type PreEtsAuthorizationReleaseFields = {
  auth_number?: string | null;
  auth_type?: string | null;
  /** Instructor visibility gate — set without requiring auth_number. */
  field_released_at?: string | null;
};

/**
 * Field staff (TS/TI) may access rosters/sessions once released to the field.
 * Auth number is optional (may be filled later under Schools & groups).
 */
export function isPreEtsAuthorizationReleasedToField(
  auth: PreEtsAuthorizationReleaseFields | null | undefined
): boolean {
  if (!auth) return false;
  if (auth.field_released_at) return true;
  // Legacy fallback before backfill / older rows without the column populated in selects
  const num = (auth.auth_number ?? "").trim();
  if (!num) return false;
  return auth.auth_type === "group" || auth.auth_type === "individual";
}

/** True when Super Admin has blocked this service month from instructor view. */
export function isPreEtsServiceMonthBlockedForField(
  block:
    | { unblocked_at?: string | null }
    | { unblocked_at?: string | null }[]
    | null
    | undefined
): boolean {
  if (!block) return false;
  const row = Array.isArray(block) ? block[0] : block;
  if (!row) return false;
  return row.unblocked_at == null;
}

/** Calendar day in America/New_York for cron scheduling. */
export function easternCalendarParts(now: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value])
  ) as Record<string, string>;
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === "24" ? "0" : parts.hour),
  };
}

/**
 * Target service month (YYYY-MM-01) that should go out on the 20th of `from` (Eastern).
 * Example: Eastern Nov 20 → December 1.
 */
export function nextPreEtsServiceMonthFromDate(from: Date = new Date()): string {
  const { year, month } = easternCalendarParts(from);
  const next = new Date(Date.UTC(year, month, 1)); // month is 1-based; Date.UTC month is 0-based → +1
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}-01`;
}

/** Day-20 cutoff (Eastern) for releasing `serviceMonth` (YYYY-MM-01). */
export function preEtsFieldReleaseCutoffParts(serviceMonth: string): {
  year: number;
  month: number;
  day: number;
} {
  const y = Number(serviceMonth.slice(0, 4));
  const m = Number(serviceMonth.slice(5, 7));
  const prev = new Date(Date.UTC(y, m - 2, 20)); // month m is 1-based → m-2 for previous
  return {
    year: prev.getUTCFullYear(),
    month: prev.getUTCMonth() + 1,
    day: 20,
  };
}

/** True once Eastern calendar date is on/after the 20th before the service month. */
export function isOnOrAfterPreEtsFieldReleaseCutoff(
  serviceMonth: string,
  now: Date = new Date()
): boolean {
  const cutoff = preEtsFieldReleaseCutoffParts(serviceMonth);
  const e = easternCalendarParts(now);
  const today = e.year * 10_000 + e.month * 100 + e.day;
  const cut = cutoff.year * 10_000 + cutoff.month * 100 + cutoff.day;
  return today >= cut;
}

/** Blank auth line on PDFs when no number yet — 20 spaces for alignment / fill-in. */
export const PRE_ETS_AUTH_NUMBER_PLACEHOLDER = " ".repeat(20);

export function formatPreEtsAuthNumberForPdf(authNumber: string | null | undefined): string {
  const trimmed = (authNumber ?? "").trim();
  return trimmed || PRE_ETS_AUTH_NUMBER_PLACEHOLDER;
}
