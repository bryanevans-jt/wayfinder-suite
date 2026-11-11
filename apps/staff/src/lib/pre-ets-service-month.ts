/**
 * Parse/validate Pre-ETS service-month query values for authorization list filters.
 * Accepts YYYY-MM (normalized to YYYY-MM-01) or a real calendar YYYY-MM-DD.
 */

export type ParsePreEtsServiceMonthResult =
  | { ok: true; serviceMonth: string; inputMonth: string }
  | { ok: false; error: string };

const MONTH_PARAM_ERROR = "month must be a valid calendar month (YYYY-MM or YYYY-MM-DD).";

function isValidYmd(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

/** True when the caller omitted a month filter (empty / whitespace). */
export function isPreEtsServiceMonthFilterOmitted(raw: string | null | undefined): boolean {
  return raw == null || raw.trim() === "";
}

/**
 * Validate a month query/filter value for use against `service_month` (date).
 * Does not treat empty as success — callers should skip filtering when omitted.
 */
export function parsePreEtsServiceMonthFilter(
  raw: string | null | undefined
): ParsePreEtsServiceMonthResult {
  if (isPreEtsServiceMonthFilterOmitted(raw)) {
    return { ok: false, error: MONTH_PARAM_ERROR };
  }

  const trimmed = String(raw).trim();

  const ym = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (ym) {
    const year = Number(ym[1]);
    const month = Number(ym[2]);
    if (!isValidYmd(year, month, 1)) {
      return { ok: false, error: MONTH_PARAM_ERROR };
    }
    return {
      ok: true,
      serviceMonth: `${ym[1]}-${ym[2]}-01`,
      inputMonth: `${ym[1]}-${ym[2]}`,
    };
  }

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidYmd(year, month, day)) {
      return { ok: false, error: MONTH_PARAM_ERROR };
    }
    return {
      ok: true,
      serviceMonth: `${ymd[1]}-${ymd[2]}-${ymd[3]}`,
      inputMonth: `${ymd[1]}-${ymd[2]}`,
    };
  }

  return { ok: false, error: MONTH_PARAM_ERROR };
}
