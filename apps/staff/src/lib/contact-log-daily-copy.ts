import {
  easternDateKey,
  formatEasternTimeOfDay,
  PORTAL_DISPLAY_TIME_ZONE,
} from "@wayfinder/branding";
import { buildClientActivityFkIds } from "@wayfinder/supabase";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

export type ContactLogDailyRow = {
  at: string;
  startAt: string | null;
  notes: string;
};

type AdminClient = ReturnType<typeof createServiceRoleClient>;

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

async function loadStartTimesByLogId(
  admin: AdminClient,
  logIds: string[]
): Promise<Map<string, string>> {
  const startByLogId = new Map<string, string>();
  if (logIds.length === 0) {
    return startByLogId;
  }

  const chunkSize = 100;
  for (let i = 0; i < logIds.length; i += chunkSize) {
    const chunk = logIds.slice(i, i + chunkSize);
    try {
      const { data: timeEntries, error } = await admin
        .from("es_time_entries")
        .select("linked_source_id, service_start_at")
        .eq("linked_source_type", "contact_log")
        .in("linked_source_id", chunk);
      if (error) {
        console.error("[contact-logs-daily] time entry lookup failed:", error.message);
        continue;
      }
      for (const entry of timeEntries ?? []) {
        const logId = entry.linked_source_id as string;
        const start = entry.service_start_at as string | null;
        if (logId && start) {
          startByLogId.set(logId, start);
        }
      }
    } catch (err) {
      console.error("[contact-logs-daily] time entry lookup threw:", err);
    }
  }

  return startByLogId;
}

export async function loadContactLogsForEasternDay(
  admin: AdminClient,
  clientId: string,
  dateYmd: string
): Promise<ContactLogDailyRow[]> {
  const { data: clientRow, error: clientErr } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr) {
    throw new Error(clientErr.message);
  }
  if (!clientRow) {
    throw new Error("Client not found.");
  }

  const fkIds = buildClientActivityFkIds(clientRow);
  if (fkIds.length === 0) {
    return [];
  }

  type ContactLogSelectRow = {
    id: string;
    client_id: string;
    created_at: string;
    public_outcome?: string | null;
    notes?: string | null;
    outcome?: string | null;
  };

  let logs: ContactLogSelectRow[] = [];
  {
    const full = await admin
      .from("contact_logs")
      .select("id, client_id, created_at, public_outcome, notes, outcome")
      .in("client_id", fkIds)
      .order("created_at", { ascending: true })
      .limit(500);

    if (!full.error) {
      logs = (full.data ?? []) as ContactLogSelectRow[];
    } else if (full.error.message.includes("notes") || full.error.message.includes("public_outcome")) {
      const mid = await admin
        .from("contact_logs")
        .select("id, client_id, created_at, public_outcome, outcome")
        .in("client_id", fkIds)
        .order("created_at", { ascending: true })
        .limit(500);
      if (!mid.error) {
        logs = (mid.data ?? []) as ContactLogSelectRow[];
      } else if (mid.error.message.includes("public_outcome")) {
        const basic = await admin
          .from("contact_logs")
          .select("id, client_id, created_at, outcome")
          .in("client_id", fkIds)
          .order("created_at", { ascending: true })
          .limit(500);
        if (basic.error) {
          throw new Error(basic.error.message);
        }
        logs = (basic.data ?? []) as ContactLogSelectRow[];
      } else {
        throw new Error(mid.error.message);
      }
    } else {
      throw new Error(full.error.message);
    }
  }

  const startByLogId = await loadStartTimesByLogId(
    admin,
    logs.map((l) => l.id)
  );

  return logs
    .map((log) => {
      const createdAt = log.created_at;
      const startAt = startByLogId.get(log.id) ?? createdAt;
      const notes = (log.public_outcome ?? log.notes ?? log.outcome ?? "").trim();
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
