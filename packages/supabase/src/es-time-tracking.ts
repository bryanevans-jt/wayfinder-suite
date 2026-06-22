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
};

export async function insertEsTimeEntry(
  supabase: SupabaseClient,
  input: InsertEsTimeEntryInput
): Promise<string> {
  const activity = await loadActivityTypeById(supabase, input.activityTypeId);
  if (!activity) {
    throw new Error("Invalid activity type");
  }

  validateDurationMinutes(activity, input.durationMinutes);

  if (activity.requires_client && !input.clientId) {
    throw new Error("This activity requires a client");
  }

  if (activity.requires_narrative) {
    const text = input.narrative?.trim() ?? "";
    if (text.length < 10) {
      throw new Error("Service narrative is required (at least 10 characters)");
    }
  }

  const flags = computeTimeEntryFlags(input.serviceDate);

  const { data, error } = await supabase
    .from("es_time_entries")
    .insert({
      es_user_id: input.esUserId,
      client_id: input.clientId,
      activity_type_id: input.activityTypeId,
      service_date: input.serviceDate,
      duration_minutes: input.durationMinutes,
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
