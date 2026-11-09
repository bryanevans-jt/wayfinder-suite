import type { SupabaseClient } from "@supabase/supabase-js";
import { rendezvousSchema } from "./supabase/admin";
import type { BusyRange, WeeklyHour } from "./scheduling/slots";
import { FREEBUSY_CACHE_TTL_MS, fetchFreeBusy } from "./google/calendar";

export type StaffScheduleRow = {
  id: string;
  staff_user_id: string;
  slug: string;
  display_name: string | null;
  enabled: boolean;
  meeting_length_minutes: number;
  buffer_minutes: number;
  min_notice_hours: number;
  booking_window_days: number;
  default_location: string | null;
  timezone: string;
  google_calendar_id: string;
};

export type BookingRow = {
  id: string;
  schedule_id: string;
  staff_user_id: string;
  starts_at: string;
  ends_at: string;
  counselor_name: string;
  counselor_email: string;
  meeting_format: "in_person" | "google_meet";
  location: string | null;
  meet_link: string | null;
  reason: string | null;
  status: "confirmed" | "cancelled" | "rescheduled";
  google_event_id: string | null;
  cancel_token_hash: string;
  reschedule_token_hash: string;
};

export async function getScheduleBySlug(
  admin: SupabaseClient,
  slug: string
): Promise<StaffScheduleRow | null> {
  const { data, error } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StaffScheduleRow | null) ?? null;
}

export async function getScheduleById(
  admin: SupabaseClient,
  id: string
): Promise<StaffScheduleRow | null> {
  const { data, error } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StaffScheduleRow | null) ?? null;
}

export async function listWeeklyHours(
  admin: SupabaseClient,
  scheduleId: string
): Promise<WeeklyHour[]> {
  const { data, error } = await rendezvousSchema(admin)
    .from("weekly_hours")
    .select("day_of_week, start_time, end_time")
    .eq("schedule_id", scheduleId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    dayOfWeek: Number(row.day_of_week),
    startTime: String(row.start_time).slice(0, 5),
    endTime: String(row.end_time).slice(0, 5),
  }));
}

export async function listConfirmedBookingsInRange(
  admin: SupabaseClient,
  staffUserId: string,
  rangeStart: Date,
  rangeEnd: Date
): Promise<BusyRange[]> {
  const { data, error } = await rendezvousSchema(admin)
    .from("bookings")
    .select("starts_at, ends_at")
    .eq("staff_user_id", staffUserId)
    .eq("status", "confirmed")
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString());
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    start: new Date(row.starts_at as string),
    end: new Date(row.ends_at as string),
  }));
}

export async function getStaffEmail(
  admin: SupabaseClient,
  staffUserId: string
): Promise<{ email: string; fullName: string } | null> {
  const [{ data: profile }, { data: authData, error: authError }] = await Promise.all([
    admin.from("profiles").select("full_name").eq("id", staffUserId).maybeSingle(),
    admin.auth.admin.getUserById(staffUserId),
  ]);
  if (authError) throw new Error(authError.message);
  const email = authData.user?.email?.trim().toLowerCase();
  if (!email) return null;
  return {
    email,
    fullName: (profile?.full_name as string | null)?.trim() || email,
  };
}

/**
 * Free/busy with short-TTL DB cache. Push webhook clears cache rows for the staff user.
 */
export async function getBusyTimesCached(opts: {
  admin: SupabaseClient;
  staffUserId: string;
  staffEmail: string;
  calendarId: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<BusyRange[]> {
  const { admin, staffUserId, staffEmail, calendarId, timeMin, timeMax } = opts;
  const db = rendezvousSchema(admin);

  const { data: cached } = await db
    .from("busy_cache")
    .select("busy_ranges, fetched_at")
    .eq("staff_user_id", staffUserId)
    .eq("window_start", timeMin.toISOString())
    .eq("window_end", timeMax.toISOString())
    .maybeSingle();

  if (cached?.fetched_at) {
    const age = Date.now() - new Date(cached.fetched_at as string).getTime();
    if (age >= 0 && age < FREEBUSY_CACHE_TTL_MS) {
      const ranges = (cached.busy_ranges as { start: string; end: string }[]) ?? [];
      return ranges.map((r) => ({ start: new Date(r.start), end: new Date(r.end) }));
    }
  }

  let busy: BusyRange[] = [];
  try {
    busy = await fetchFreeBusy({
      staffEmail,
      calendarId,
      timeMin,
      timeMax,
    });
  } catch (err) {
    // Keep weekly-hour slots available even when Google DWD/key setup is incomplete.
    console.error("Google freebusy unavailable; returning schedule without calendar busy:", err);
    return [];
  }

  await db.from("busy_cache").upsert(
    {
      staff_user_id: staffUserId,
      window_start: timeMin.toISOString(),
      window_end: timeMax.toISOString(),
      busy_ranges: busy.map((b) => ({
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      })),
      fetched_at: new Date().toISOString(),
    },
    { onConflict: "staff_user_id,window_start,window_end" }
  );

  return busy;
}

export async function invalidateBusyCache(
  admin: SupabaseClient,
  staffUserId: string
): Promise<void> {
  await rendezvousSchema(admin).from("busy_cache").delete().eq("staff_user_id", staffUserId);
}
