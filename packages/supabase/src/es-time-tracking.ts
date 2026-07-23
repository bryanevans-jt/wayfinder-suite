import type { SupabaseClient } from "@supabase/supabase-js";

export type ServiceActivityType = {
  id: string;
  code: string;
  category: string;
  name: string;
  default_minutes: number;
  min_minutes: number;
  max_minutes: number;
  requires_client: boolean;
  requires_narrative: boolean;
  is_billable: boolean;
};

export type EsTimeLinkedSource =
  | "contact_log"
  | "application"
  | "stage_event"
  | "meeting"
  | "message_thread"
  | "employer"
  | "natural_support"
  | "manual";

export type EsTimeEntryStatus = "draft" | "submitted" | "approved" | "rejected";

export const DEFAULT_ACTIVITY_CODES = {
  contact: "JT-ACT-010",
  application: "JT-ACT-020",
  stage: "JT-ACT-040",
  meeting: "JT-ACT-011",
  manual: "JT-ACT-040",
} as const;

const SIXTY_MINUTE_ACTIVITY_CODES = new Set(["JT-ACT-011", "JT-ACT-012"]);

/** Default billable minutes for an activity (UI + server). */
export function defaultActivityMinutes(activity: Pick<ServiceActivityType, "code" | "default_minutes">): number {
  if (SIXTY_MINUTE_ACTIVITY_CODES.has(activity.code)) {
    return 60;
  }
  return activity.default_minutes;
}

/** Activity types shown when logging client contact (excludes staff-only types). */
export function filterClientContactActivityTypes(
  types: ServiceActivityType[]
): ServiceActivityType[] {
  return types.filter((t) => t.requires_client);
}

/** Pay week starts Sunday (local calendar date string YYYY-MM-DD). */
export function weekStartSunday(input: Date | string): string {
  const d = typeof input === "string" ? parseLocalDate(input) : new Date(input);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return formatLocalDate(d);
}

export function weekEndSaturday(weekStart: string): string {
  const d = parseLocalDate(weekStart);
  d.setDate(d.getDate() + 6);
  return formatLocalDate(d);
}

export function parseLocalDate(isoDate: string): Date {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayLocalDate(): string {
  return formatLocalDate(new Date());
}

export function validateDurationMinutes(
  activity: Pick<ServiceActivityType, "min_minutes" | "max_minutes" | "name">,
  minutes: number
): void {
  if (!Number.isFinite(minutes) || minutes < activity.min_minutes || minutes > activity.max_minutes) {
    throw new Error(
      `${activity.name}: enter ${activity.min_minutes}–${activity.max_minutes} minutes`
    );
  }
}

export function computeTimeEntryFlags(serviceDate: string): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  const service = parseLocalDate(serviceDate);
  const today = parseLocalDate(todayLocalDate());
  const diffDays = Math.floor((today.getTime() - service.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 7) {
    flags.late_entry = true;
  }
  return flags;
}

export async function loadActiveActivityTypes(
  supabase: SupabaseClient
): Promise<ServiceActivityType[]> {
  const { data, error } = await supabase
    .from("service_activity_types")
    .select(
      "id, code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable"
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ServiceActivityType[];
}

export async function loadActivityTypeById(
  supabase: SupabaseClient,
  id: string
): Promise<ServiceActivityType | null> {
  const { data, error } = await supabase
    .from("service_activity_types")
    .select(
      "id, code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable"
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ServiceActivityType | null) ?? null;
}

export async function loadActivityTypeByCode(
  supabase: SupabaseClient,
  code: string
): Promise<ServiceActivityType | null> {
  const { data, error } = await supabase
    .from("service_activity_types")
    .select(
      "id, code, category, name, default_minutes, min_minutes, max_minutes, requires_client, requires_narrative, is_billable"
    )
    .eq("code", code)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as ServiceActivityType | null) ?? null;
}

export type InsertEsTimeEntryInput = {
  esUserId: string;
  clientId: string | null;
  activityTypeId: string;
  serviceDate: string;
  durationMinutes: number;
  narrative: string | null;
  linkedSourceType?: EsTimeLinkedSource | null;
  linkedSourceId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  recordedAt?: Date;
};

export async function insertEsTimeEntry(
  supabase: SupabaseClient,
  input: InsertEsTimeEntryInput
): Promise<string> {
  const activity = await loadActivityTypeById(supabase, input.activityTypeId);
  if (!activity) {
    throw new Error("Invalid activity type");
  }

  if (activity.requires_client && !input.clientId) {
    throw new Error("This activity requires a client");
  }

  if (activity.requires_narrative) {
    const text = input.narrative?.trim() ?? "";
    if (text.length < 10) {
      throw new Error("Service narrative is required (at least 10 characters)");
    }
  }

  const startTime = input.startTime?.trim() || null;
  const endTime = input.endTime?.trim() || null;
  if (!startTime && !endTime) {
    throw new Error("Enter a start time, an end time, or both (duration is always required)");
  }

  const normalized = normalizeTimeEntryClock({
    serviceDate: input.serviceDate,
    durationMinutes: input.durationMinutes,
    startTime,
    endTime,
  });
  validateDurationMinutes(activity, normalized.durationMinutes);

  const flags = computeTimeEntryFlags(input.serviceDate);
  const { service_start_at, service_end_at } = resolveServiceTimestamps({
    serviceDate: input.serviceDate,
    durationMinutes: normalized.durationMinutes,
    startTime: normalized.startTime,
    endTime: normalized.endTime,
    recordedAt: input.recordedAt,
  });

  const { data, error } = await supabase
    .from("es_time_entries")
    .insert({
      es_user_id: input.esUserId,
      client_id: input.clientId,
      activity_type_id: input.activityTypeId,
      service_date: input.serviceDate,
      duration_minutes: normalized.durationMinutes,
      service_start_at,
      service_end_at,
      narrative: input.narrative?.trim() || null,
      linked_source_type: input.linkedSourceType ?? null,
      linked_source_id: input.linkedSourceId ?? null,
      status: "draft",
      flags,
    })
    .select("id")
    .maybeSingle();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not save time entry");
  }

  return data.id as string;
}

export function groupActivityTypesByCategory(
  types: ServiceActivityType[]
): Map<string, ServiceActivityType[]> {
  const map = new Map<string, ServiceActivityType[]>();
  for (const t of types) {
    const list = map.get(t.category) ?? [];
    list.push(t);
    map.set(t.category, list);
  }
  return map;
}

export function minutesToDecimalHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatTimeInputValue(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

export function combineServiceDateAndTime(serviceDate: string, timeValue: string): Date {
  const [hours, minutes] = timeValue.split(":").map(Number);
  const date = parseLocalDate(serviceDate);
  date.setHours(hours, minutes ?? 0, 0, 0);
  return date;
}

export function formatServiceTimeOfDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export type ResolveServiceTimestampsInput = {
  serviceDate: string;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
  recordedAt?: Date;
};

export type NormalizedTimeClock = {
  durationMinutes: number;
  startTime: string;
  endTime: string;
  /** True when both clock times were provided and duration was replaced by the clock span. */
  durationMatchedToClock: boolean;
};

/** Minutes between HH:mm times on a service date (handles overnight). */
export function minutesBetweenServiceTimes(
  serviceDate: string,
  startTime: string,
  endTime: string
): number | null {
  const start = combineServiceDateAndTime(serviceDate, startTime);
  let end = combineServiceDateAndTime(serviceDate, endTime);
  if (end.getTime() <= start.getTime()) {
    end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
  }
  const diff = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
  return diff > 0 ? diff : null;
}

/**
 * Require duration plus at least one clock time. Auto-fill the blank clock side from duration.
 * When both clocks are set, duration becomes the clock span (payroll/billing source of truth).
 */
export function normalizeTimeEntryClock(input: {
  serviceDate: string;
  durationMinutes: number;
  startTime?: string | null;
  endTime?: string | null;
}): NormalizedTimeClock {
  const startTime = input.startTime?.trim() || "";
  const endTime = input.endTime?.trim() || "";
  const duration = Math.round(input.durationMinutes);

  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Duration (minutes) is required");
  }
  if (!startTime && !endTime) {
    throw new Error("Enter a start time, an end time, or both (duration is always required)");
  }

  if (startTime && endTime) {
    const span = minutesBetweenServiceTimes(input.serviceDate, startTime, endTime);
    if (!span) {
      throw new Error("End time must be after start time");
    }
    return {
      durationMinutes: span,
      startTime,
      endTime,
      durationMatchedToClock: span !== duration,
    };
  }

  if (startTime) {
    const start = combineServiceDateAndTime(input.serviceDate, startTime);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    return {
      durationMinutes: duration,
      startTime,
      endTime: formatTimeInputValue(end),
      durationMatchedToClock: false,
    };
  }

  const end = combineServiceDateAndTime(input.serviceDate, endTime);
  const start = new Date(end.getTime() - duration * 60 * 1000);
  return {
    durationMinutes: duration,
    startTime: formatTimeInputValue(start),
    endTime,
    durationMatchedToClock: false,
  };
}

/** Resolve start/end timestamps after normalizeTimeEntryClock (or legacy recordedAt fallback). */
export function resolveServiceTimestamps(input: ResolveServiceTimestampsInput): {
  service_start_at: string;
  service_end_at: string;
} {
  const startTime = input.startTime?.trim() || null;
  const endTime = input.endTime?.trim() || null;

  if (startTime || endTime) {
    const normalized = normalizeTimeEntryClock({
      serviceDate: input.serviceDate,
      durationMinutes: input.durationMinutes,
      startTime,
      endTime,
    });
    const start = combineServiceDateAndTime(input.serviceDate, normalized.startTime);
    let end = combineServiceDateAndTime(input.serviceDate, normalized.endTime);
    if (end.getTime() <= start.getTime()) {
      end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    return {
      service_start_at: start.toISOString(),
      service_end_at: end.toISOString(),
    };
  }

  // Legacy entries without clock times (should not be created by current UI).
  const end = input.recordedAt ?? new Date();
  const start = new Date(end.getTime() - input.durationMinutes * 60 * 1000);
  return {
    service_start_at: start.toISOString(),
    service_end_at: end.toISOString(),
  };
}

export type TimeIntervalMs = { startMs: number; endMs: number };

/** Merge overlapping intervals; overlapping minutes count once (payroll hours worked). */
export function mergeWorkedMinutes(intervals: TimeIntervalMs[]): number {
  const valid = intervals
    .filter((i) => Number.isFinite(i.startMs) && Number.isFinite(i.endMs) && i.endMs > i.startMs)
    .sort((a, b) => a.startMs - b.startMs);
  if (valid.length === 0) {
    return 0;
  }

  let totalMs = 0;
  let curStart = valid[0]!.startMs;
  let curEnd = valid[0]!.endMs;

  for (let i = 1; i < valid.length; i += 1) {
    const next = valid[i]!;
    if (next.startMs <= curEnd) {
      curEnd = Math.max(curEnd, next.endMs);
    } else {
      totalMs += curEnd - curStart;
      curStart = next.startMs;
      curEnd = next.endMs;
    }
  }
  totalMs += curEnd - curStart;
  return Math.round(totalMs / (60 * 1000));
}

/** Billable minutes = sum of entry durations (may overlap across clients). */
export function sumBillableMinutes(
  entries: Array<{ duration_minutes: number }>
): number {
  return entries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
}

/** Hours worked from entry clock ranges; falls back to duration when timestamps missing. */
export function workedMinutesFromEntries(
  entries: Array<{
    duration_minutes: number;
    service_start_at?: string | null;
    service_end_at?: string | null;
  }>
): number {
  const intervals: TimeIntervalMs[] = [];
  for (const e of entries) {
    if (e.service_start_at && e.service_end_at) {
      const startMs = new Date(e.service_start_at).getTime();
      const endMs = new Date(e.service_end_at).getTime();
      if (endMs > startMs) {
        intervals.push({ startMs, endMs });
        continue;
      }
    }
    // No usable clock: count full duration as a non-mergeable block via synthetic gap.
    // Place sequentially so they don't falsely overlap each other.
    const lastEnd = intervals.length ? intervals[intervals.length - 1]!.endMs : Date.UTC(2000, 0, 1);
    const startMs = lastEnd + 60_000;
    intervals.push({
      startMs,
      endMs: startMs + Math.max(0, e.duration_minutes) * 60 * 1000,
    });
  }
  return mergeWorkedMinutes(intervals);
}

export function displayServiceTimes(entry: {
  service_start_at?: string | null;
  service_end_at?: string | null;
  created_at?: string | null;
  duration_minutes: number;
}): { start: string; end: string } {
  if (entry.service_start_at && entry.service_end_at) {
    return {
      start: formatServiceTimeOfDay(entry.service_start_at),
      end: formatServiceTimeOfDay(entry.service_end_at),
    };
  }

  const endDate = entry.service_end_at
    ? new Date(entry.service_end_at)
    : entry.created_at
      ? new Date(entry.created_at)
      : null;
  if (!endDate) {
    return { start: "—", end: "—" };
  }
  const startDate = new Date(endDate.getTime() - entry.duration_minutes * 60 * 1000);
  return {
    start: formatServiceTimeOfDay(startDate.toISOString()),
    end: formatServiceTimeOfDay(endDate.toISOString()),
  };
}
