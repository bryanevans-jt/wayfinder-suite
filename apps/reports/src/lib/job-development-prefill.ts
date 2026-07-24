import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contactLogDisplayText,
  fetchContactLogsWithSchemaFallback,
} from "@wayfinder/supabase/contact-logs-query";

export type JobDevelopmentContactRow = {
  rdate: string;
  business: string;
  contact: string;
  results: string;
};

function monthBounds(month: string): { from: string; to: string } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const mon = Number(match[2]);
  if (mon < 1 || mon > 12) return null;
  const from = `${month}-01T00:00:00.000Z`;
  const lastDay = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const to = `${month}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
  return { from, to };
}

const REPORT_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

async function loadContactLogsForMonth(
  admin: SupabaseClient,
  clientId: string,
  bounds: { from: string; to: string }
) {
  return fetchContactLogsWithSchemaFallback(async (cols) => {
    // Prefill selects omit id/client_id — strip them from shared shapes.
    const selectCols = cols
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c !== "id" && c !== "client_id")
      .join(", ");
    const result = await admin
      .from("contact_logs")
      .select(selectCols)
      .eq("client_id", clientId)
      .gte("created_at", bounds.from)
      .lte("created_at", bounds.to)
      .order("created_at", { ascending: true });
    return {
      data: (result.data as Record<string, unknown>[] | null) ?? null,
      error: result.error,
    };
  });
}

/** Build job development narrative from Wayfinder contact logs for the reporting month. */
export async function buildJobDevelopmentFromContactLogs(
  admin: SupabaseClient,
  clientId: string,
  month: string
): Promise<string> {
  const bounds = monthBounds(month);
  if (!bounds) {
    return "";
  }

  const logs = await loadContactLogsForMonth(admin, clientId, bounds);
  if (!logs.length) {
    return "";
  }

  const lines: string[] = [];
  for (const log of logs) {
    const when = REPORT_DATE.format(new Date(log.created_at as string));
    const outcome =
      contactLogDisplayText({
        public_outcome: log.public_outcome as string | null | undefined,
        outcome: log.outcome as string | null | undefined,
        notes: null,
      }) || "Contact";
    const internal = (log.notes as string | null)?.trim();
    lines.push(`${when} — ${outcome}`);
    if (internal) {
      lines.push(internal);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

/** Structured job-development contact rows for TN IPS monthly progress table prefill. */
export async function buildJobDevelopmentContactRows(
  admin: SupabaseClient,
  clientId: string,
  month: string
): Promise<JobDevelopmentContactRow[]> {
  const bounds = monthBounds(month);
  if (!bounds) return [];

  const [{ data: applications }, logs, { data: timeEntries }] = await Promise.all([
    admin
      .from("applications")
      .select("created_at, company_name, status, notes")
      .eq("client_id", clientId)
      .gte("created_at", bounds.from)
      .lte("created_at", bounds.to)
      .order("created_at", { ascending: true }),
    loadContactLogsForMonth(admin, clientId, bounds),
    admin
      .from("es_time_entries")
      .select("service_date, narrative, service_activity_types(name, category, wayfinder_source_hint)")
      .eq("client_id", clientId)
      .gte("service_date", bounds.from.slice(0, 10))
      .lte("service_date", bounds.to.slice(0, 10))
      .order("service_date", { ascending: true }),
  ]);

  const rows: JobDevelopmentContactRow[] = [];

  for (const app of applications ?? []) {
    const business = (app.company_name as string | null)?.trim() ?? "";
    const status = (app.status as string | null)?.trim() ?? "";
    const notes = (app.notes as string | null)?.trim() ?? "";
    const results = [status, notes].filter(Boolean).join(" — ") || "Application activity";
    rows.push({
      rdate: toIsoDate(app.created_at as string),
      business,
      contact: "",
      results,
    });
  }

  for (const log of logs) {
    const outcome = contactLogDisplayText({
      public_outcome: log.public_outcome as string | null | undefined,
      outcome: log.outcome as string | null | undefined,
      notes: null,
    });
    const notes = (log.notes as string | null)?.trim() ?? "";
    const results = [outcome, notes].filter(Boolean).join(" — ");
    if (!results) continue;
    rows.push({
      rdate: toIsoDate(log.created_at as string),
      business: "",
      contact: "",
      results,
    });
  }

  for (const entry of timeEntries ?? []) {
    const activity = entry.service_activity_types as
      | { name?: string; category?: string; wayfinder_source_hint?: string }
      | null
      | undefined;
    const hint = `${activity?.name ?? ""} ${activity?.category ?? ""} ${activity?.wayfinder_source_hint ?? ""}`.toLowerCase();
    if (!hint.includes("job development") && !hint.includes("employer") && !hint.includes("application")) {
      continue;
    }
    const narrative = (entry.narrative as string | null)?.trim() ?? "";
    if (!narrative) continue;
    rows.push({
      rdate: entry.service_date as string,
      business: "",
      contact: "",
      results: narrative,
    });
  }

  rows.sort((a, b) => a.rdate.localeCompare(b.rdate));

  const deduped: JobDevelopmentContactRow[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.rdate}|${row.business}|${row.results}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(row);
    if (deduped.length >= 7) break;
  }

  return deduped;
}
