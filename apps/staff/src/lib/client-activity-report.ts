import { clientDisplayName } from "@wayfinder/branding";
import type { ActivityLogRow } from "@/lib/portal-data";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";

const REPORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: PORTAL_DISPLAY_TIME_ZONE,
});

const RANGE_DATE = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

function kindLabel(kind: ActivityLogRow["kind"]): string {
  switch (kind) {
    case "contact":
      return "Contact";
    case "application":
      return "Application";
    case "stage":
      return "Stage update";
    case "meeting":
      return "Meeting";
    default:
      return "Activity";
  }
}

export function formatClientActivityReportText(opts: {
  clientName: string;
  esName: string;
  dateFrom: string;
  dateTo: string;
  rows: ActivityLogRow[];
}): string {
  const { clientName, esName, dateFrom, dateTo, rows } = opts;
  const chronological = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  const lines: string[] = [
    "CLIENT ACTIVITY REPORT",
    `Client: ${clientName}`,
    `Period: ${RANGE_DATE.format(new Date(dateFrom + "T12:00:00"))} – ${RANGE_DATE.format(new Date(dateTo + "T12:00:00"))}`,
    `Prepared by: ${esName}, Employment Specialist`,
    "",
  ];

  if (chronological.length === 0) {
    lines.push("No documented activity in this date range.");
    return lines.join("\n");
  }

  for (const row of chronological) {
    const when = REPORT_DATE.format(new Date(row.created_at));
    lines.push(`${when} — ${kindLabel(row.kind)}`);
    lines.push(`  ${row.summary}`);
    if (row.detail?.trim()) {
      lines.push(`  Notes: ${row.detail.trim()}`);
    }
    lines.push("");
  }

  lines.push(`Total activities: ${chronological.length}`);
  return lines.join("\n").trimEnd();
}

export function formatClientActivityReportHtml(opts: {
  clientName: string;
  esName: string;
  dateFrom: string;
  dateTo: string;
  rows: ActivityLogRow[];
}): string {
  return formatClientActivityReportText(opts);
}

export function clientNameFromRow(rows: ActivityLogRow[]): string {
  return rows[0]?.client_name ?? "Client";
}

export { clientDisplayName };
