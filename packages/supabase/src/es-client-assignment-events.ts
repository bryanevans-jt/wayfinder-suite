import type { SupabaseClient } from "@supabase/supabase-js";

export type AssignmentEventRow = {
  client_id: string;
  es_user_id: string;
  effective_at: string;
};

/** Record a caseload assign/reassign (call after es_client_assignments insert). */
export async function recordEsClientAssignmentEvent(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    esUserId: string;
    actorUserId?: string | null;
    source?: string | null;
    effectiveAt?: Date;
  }
): Promise<void> {
  const { error } = await admin.from("es_client_assignment_events").insert({
    client_id: opts.clientId,
    es_user_id: opts.esUserId,
    actor_user_id: opts.actorUserId ?? null,
    source: opts.source ?? null,
    effective_at: (opts.effectiveAt ?? new Date()).toISOString(),
  });
  if (error) {
    console.error("[es_client_assignment_events] insert failed:", error.message);
  }
}

const MONTH_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function calendarMonthBoundsFromKey(monthKey: string): { start: string; end: string } {
  const match = MONTH_KEY_RE.exec(monthKey.trim());
  if (!match) {
    throw new Error("Invalid month (expected YYYY-MM)");
  }
  const [y, m] = monthKey.split("-").map(Number);
  const start = `${monthKey}-01`;
  const lastDayUtc = new Date(Date.UTC(y, m, 0, 12, 0, 0));
  const end = `${lastDayUtc.getUTCFullYear()}-${String(lastDayUtc.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDayUtc.getUTCDate()).padStart(2, "0")}`;
  return { start, end };
}

/** Inclusive month window as UTC instants (for comparing assignment effective_at). */
export function calendarMonthInstantBounds(monthKey: string): { startIso: string; endIso: string } {
  const { start, end } = calendarMonthBoundsFromKey(monthKey);
  const startIso = `${start}T00:00:00.000Z`;
  const endIso = `${end}T23:59:59.999Z`;
  return { startIso, endIso };
}

type Segment = { esUserId: string; startMs: number; endMs: number };

function buildSegmentsForClient(events: AssignmentEventRow[]): Segment[] {
  const sorted = [...events].sort(
    (a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at)
  );
  const segments: Segment[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const startMs = Date.parse(sorted[i].effective_at);
    const endMs =
      i + 1 < sorted.length ? Date.parse(sorted[i + 1].effective_at) : Number.POSITIVE_INFINITY;
    segments.push({
      esUserId: sorted[i].es_user_id,
      startMs,
      endMs,
    });
  }
  return segments;
}

export function assigneesOverlappingMonth(
  events: AssignmentEventRow[],
  monthKey: string
): string[] {
  const { startIso, endIso } = calendarMonthInstantBounds(monthKey);
  const monthStartMs = Date.parse(startIso);
  const monthEndMs = Date.parse(endIso);
  const segments = buildSegmentsForClient(events);
  const ids = new Set<string>();
  for (const seg of segments) {
    if (seg.startMs <= monthEndMs && seg.endMs > monthStartMs) {
      ids.add(seg.esUserId);
    }
  }
  return [...ids];
}

/** Last assignee with an assignment event on or before month end (handles end-of-month unassign). */
export function lastAssigneeInCalendarMonth(
  events: AssignmentEventRow[],
  monthKey: string
): string | null {
  const { endIso } = calendarMonthInstantBounds(monthKey);
  const monthEndMs = Date.parse(endIso);
  let last: string | null = null;
  let lastMs = -1;
  for (const ev of events) {
    const ms = Date.parse(ev.effective_at);
    if (ms <= monthEndMs && ms >= lastMs) {
      lastMs = ms;
      last = ev.es_user_id;
    }
  }
  return last;
}

export function buildAssigneeIdsByClientFromEvents(
  eventsByClient: Map<string, AssignmentEventRow[]>,
  monthKey: string
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [clientId, events] of eventsByClient) {
    out.set(clientId, assigneesOverlappingMonth(events, monthKey));
  }
  return out;
}

export function buildLastAssigneeByClientFromEvents(
  eventsByClient: Map<string, AssignmentEventRow[]>,
  monthKey: string
): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const [clientId, events] of eventsByClient) {
    out.set(clientId, lastAssigneeInCalendarMonth(events, monthKey));
  }
  return out;
}

/**
 * Calendar day (America/New_York) when `migration_backfill` assignment events were
 * introduced. Job starts before this date do not have reliable pre-history in
 * es_client_assignment_events — credit the earliest known assignee instead.
 */
export const ASSIGNMENT_HISTORY_BACKFILL_DAY = "2026-07-07";

/**
 * Who was assigned to the client on a given America/New_York calendar date
 * (typically clients.job_start_date). Uses assignment segments; for dates before
 * {@link ASSIGNMENT_HISTORY_BACKFILL_DAY}, infers from the earliest known event.
 */
export function assigneeOnCalendarDate(
  events: AssignmentEventRow[],
  dateYmd: string
): string | null {
  const day = dateYmd.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || events.length === 0) {
    return null;
  }

  const sorted = [...events].sort(
    (a, b) => Date.parse(a.effective_at) - Date.parse(b.effective_at)
  );

  if (day < ASSIGNMENT_HISTORY_BACKFILL_DAY) {
    return sorted[0]?.es_user_id ?? null;
  }

  // Noon UTC on the calendar date is a stable point inside the NY local day for
  // assignment attribution (job_start_date has no time component).
  const atMs = Date.parse(`${day}T12:00:00.000Z`);
  if (!Number.isFinite(atMs)) return null;

  let current: string | null = null;
  for (const ev of sorted) {
    const ms = Date.parse(ev.effective_at);
    if (ms <= atMs) {
      current = ev.es_user_id;
    } else {
      break;
    }
  }
  return current;
}
