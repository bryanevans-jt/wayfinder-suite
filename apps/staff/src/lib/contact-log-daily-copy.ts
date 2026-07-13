import {
  easternDateKey,
  formatEasternTimeOfDay,
  PORTAL_DISPLAY_TIME_ZONE,
} from "@wayfinder/branding";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export type ContactLogDailyRow = {
  at: string;
  startAt: string | null;
  notes: string;
};

export function formatContactLogsDailyVprText(rows: ContactLogDailyRow[]): string {
  if (rows.length === 0) {
    return "No contact notes for this day.";
  }

  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: PORTAL_DISPLAY_TIME_ZONE,
  });

  const blocks: string[] = [];
  for (const row of rows) {
    const anchor = row.startAt ?? row.at;
    const dateLabel = dateFormatter.format(new Date(anchor));
    const timeLabel = formatEasternTimeOfDay(anchor);
    const notes = row.notes.trim() || "—";
    blocks.push(`${dateLabel}\n${timeLabel}\n${notes}`);
  }

  return blocks.join("\n\n");
}

export async function loadContactLogsForEasternDay(
  admin: ReturnType<typeof createServiceRoleClient>,
  clientId: string,
  dateYmd: string
): Promise<ContactLogDailyRow[]> {
  const { data: logs, error } = await admin
    .from("contact_logs")
    .select("id, client_id, created_at, public_outcome, outcome")
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  const logIds = (logs ?? []).map((l) => l.id as string);
  const startByLogId = new Map<string, string>();

  if (logIds.length > 0) {
    const { data: timeEntries } = await admin
      .from("es_time_entries")
      .select("linked_source_id, service_start_at")
      .eq("linked_source_type", "contact_log")
      .in("linked_source_id", logIds);

    for (const entry of timeEntries ?? []) {
      const logId = entry.linked_source_id as string;
      const start = entry.service_start_at as string | null;
      if (logId && start) {
        startByLogId.set(logId, start);
      }
    }
  }

  return (logs ?? [])
    .map((log) => {
      const logId = log.id as string;
      const createdAt = log.created_at as string;
      const startAt = startByLogId.get(logId) ?? createdAt;
      const notes =
        ((log.public_outcome as string | null) ?? (log.outcome as string | null) ?? "").trim();
      return {
        at: createdAt,
        startAt,
        notes,
        dayKey: easternDateKey(startAt),
      };
    })
    .filter((row) => row.dayKey === dateYmd)
    .map(({ at, startAt, notes }) => ({ at, startAt, notes }));
}

/** Today's date in Eastern Time (YYYY-MM-DD). */
export function easternTodayYmd(now = new Date()): string {
  return easternDateKey(now.toISOString());
}
