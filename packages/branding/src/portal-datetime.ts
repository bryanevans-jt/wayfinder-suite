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
