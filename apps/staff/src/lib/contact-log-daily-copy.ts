import {
  easternDateKey,
  easternDayUtcSearchWindow,
  formatEasternTimeOfDay,
  PORTAL_DISPLAY_TIME_ZONE,
} from "@wayfinder/branding";
import { buildClientActivityFkIds } from "@wayfinder/supabase/client-activity-fk";
import {
  contactLogDisplayText,
  fetchContactLogsWithSchemaFallback,
} from "@wayfinder/supabase/contact-logs-query";
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

/**
 * Also find contact logs whose service_start_at falls in the search window
 * (covers backdated activity entered on a later night).
 */
async function loadContactLogIdsByServiceStartWindow(
  admin: AdminClient,
  startIso: string,
  endIso: string
): Promise<string[]> {
  try {
    const { data, error } = await admin
      .from("es_time_entries")
      .select("linked_source_id")
      .eq("linked_source_type", "contact_log")
      .gte("service_start_at", startIso)
      .lt("service_start_at", endIso)
      .limit(1000);
    if (error) {
      console.error("[contact-logs-daily] service_start window lookup failed:", error.message);
      return [];
    }
    return [...new Set((data ?? []).map((r) => r.linked_source_id as string).filter(Boolean))];
  } catch (err) {
    console.error("[contact-logs-daily] service_start window lookup threw:", err);
    return [];
  }
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

  const { startIso, endIso } = easternDayUtcSearchWindow(dateYmd);

  // Prefer a date-windowed query so long-history clients are not truncated to the oldest 500.
  const windowed = await fetchContactLogsWithSchemaFallback(async (cols) => {
    const result = await admin
      .from("contact_logs")
      .select(cols)
      .in("client_id", fkIds)
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .order("created_at", { ascending: true })
      .limit(1000);
    return {
      data: (result.data as Record<string, unknown>[] | null) ?? null,
      error: result.error,
    };
  });

  const byId = new Map(
    windowed.map((row) => [
      row.id as string,
      {
        id: row.id as string,
        client_id: row.client_id as string,
        created_at: row.created_at as string,
        public_outcome: (row.public_outcome as string | null | undefined) ?? null,
        notes: (row.notes as string | null | undefined) ?? null,
        outcome: (row.outcome as string | null | undefined) ?? null,
        logged_by: (row.logged_by as string | null | undefined) ?? null,
      },
    ])
  );

  // Pull any logs whose clocked service start is on/near this day but created_at is outside the window.
  const startLinkedIds = await loadContactLogIdsByServiceStartWindow(admin, startIso, endIso);
  const missingIds = startLinkedIds.filter((id) => !byId.has(id));
  if (missingIds.length > 0) {
    const extras = await fetchContactLogsWithSchemaFallback(async (cols) => {
      const result = await admin
        .from("contact_logs")
        .select(cols)
        .in("id", missingIds)
        .in("client_id", fkIds);
      return {
        data: (result.data as Record<string, unknown>[] | null) ?? null,
        error: result.error,
      };
    });
    for (const row of extras) {
      byId.set(row.id as string, {
        id: row.id as string,
        client_id: row.client_id as string,
        created_at: row.created_at as string,
        public_outcome: (row.public_outcome as string | null | undefined) ?? null,
        notes: (row.notes as string | null | undefined) ?? null,
        outcome: (row.outcome as string | null | undefined) ?? null,
        logged_by: (row.logged_by as string | null | undefined) ?? null,
      });
    }
  }

  const logs = [...byId.values()];
  const startByLogId = await loadStartTimesByLogId(
    admin,
    logs.map((l) => l.id)
  );

  return logs
    .map((log) => {
      const createdAt = log.created_at;
      const startAt = startByLogId.get(log.id) ?? createdAt;
      const notes = contactLogDisplayText(log);
      return {
        at: createdAt,
        startAt,
        notes,
        // Match either the clocked service day or the day the note was entered (Eastern).
        // Late-night logging often creates Aug 18 ET entries with Aug 19 service_start_at.
        matchesDay:
          easternDateKey(startAt) === dateYmd || easternDateKey(createdAt) === dateYmd,
      };
    })
    .filter((row) => row.matchesDay)
    .sort((a, b) => {
      const aKey = a.startAt ?? a.at;
      const bKey = b.startAt ?? b.at;
      return aKey.localeCompare(bKey);
    })
    .map(({ at, startAt, notes }) => ({ at, startAt, notes }));
}

/** Nearby Eastern days that have contact notes (for empty-compile hints). */
export async function listNearbyContactLogDays(
  admin: AdminClient,
  clientId: string,
  aroundDateYmd: string,
  radiusDays = 7
): Promise<string[]> {
  const { data: clientRow } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();
  if (!clientRow) return [];

  const fkIds = buildClientActivityFkIds(clientRow);
  if (fkIds.length === 0) return [];

  const center = new Date(`${aroundDateYmd}T12:00:00.000Z`);
  if (Number.isNaN(center.getTime())) return [];
  const start = new Date(center.getTime() - radiusDays * 86400000).toISOString();
  const end = new Date(center.getTime() + (radiusDays + 1) * 86400000).toISOString();

  const rows = await fetchContactLogsWithSchemaFallback(async (cols) => {
    const result = await admin
      .from("contact_logs")
      .select(cols)
      .in("client_id", fkIds)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false })
      .limit(500);
    return {
      data: (result.data as Record<string, unknown>[] | null) ?? null,
      error: result.error,
    };
  });

  const startByLogId = await loadStartTimesByLogId(
    admin,
    rows.map((r) => r.id as string)
  );

  const days = new Set<string>();
  for (const row of rows) {
    const createdAt = row.created_at as string;
    const startAt = startByLogId.get(row.id as string) ?? createdAt;
    days.add(easternDateKey(startAt));
    days.add(easternDateKey(createdAt));
  }

  return [...days].sort().reverse();
}

/** Today's date in Eastern Time (YYYY-MM-DD). */
export function easternTodayYmd(now = new Date()): string {
  return easternDateKey(now.toISOString());
}
