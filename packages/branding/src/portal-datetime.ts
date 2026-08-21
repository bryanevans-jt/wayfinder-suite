/** Georgia operations timezone — all staff/client activity displays use Eastern Time. */
export const PORTAL_DISPLAY_TIME_ZONE = "America/New_York";

/** e.g. "May 12, 2026, 4:00 PM" for activity timelines */
export function formatPortalDateTime(
  iso: string,
  timeZone: string = PORTAL_DISPLAY_TIME_ZONE
): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone,
  }).format(d);
}

/** Calendar date in Eastern Time (YYYY-MM-DD). */
export function easternDateKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso.slice(0, 10);
  }
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "0000";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

/**
 * Loose UTC window that fully covers an Eastern calendar day (and neighbors),
 * so callers can filter precisely with {@link easternDateKey} afterward.
 * Eastern is UTC−5/−4, so we pad one calendar day on each side.
 */
export function easternDayUtcSearchWindow(dateYmd: string): { startIso: string; endIso: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateYmd.trim());
  if (!match) {
    const fallback = new Date();
    return {
      startIso: new Date(fallback.getTime() - 2 * 86400000).toISOString(),
      endIso: new Date(fallback.getTime() + 2 * 86400000).toISOString(),
    };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  // Pad ±1 calendar day in UTC to absorb EST/EDT and late-night logging.
  const start = new Date(Date.UTC(y, m - 1, d - 1, 0, 0, 0));
  const end = new Date(Date.UTC(y, m - 1, d + 2, 0, 0, 0));
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

/** Time-of-day in Eastern Time, e.g. "9:30 AM". */
export function formatEasternTimeOfDay(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
  }).format(d);
}
