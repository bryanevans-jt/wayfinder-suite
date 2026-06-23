import type { SupabaseClient } from "@supabase/supabase-js";

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

  const { data: logs } = await admin
    .from("contact_logs")
    .select("created_at, public_outcome, notes, outcome")
    .eq("client_id", clientId)
    .gte("created_at", bounds.from)
    .lte("created_at", bounds.to)
    .order("created_at", { ascending: true });

  if (!logs?.length) {
    return "";
  }

  const lines: string[] = [];
  for (const log of logs) {
    const when = REPORT_DATE.format(new Date(log.created_at as string));
    const outcome =
      (log.public_outcome as string | null)?.trim() ||
      (log.outcome as string | null)?.trim() ||
      "Contact";
    const internal = (log.notes as string | null)?.trim();
    lines.push(`${when} — ${outcome}`);
    if (internal) {
      lines.push(internal);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}
