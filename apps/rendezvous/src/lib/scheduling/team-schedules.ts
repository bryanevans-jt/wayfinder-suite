import type { SupabaseClient } from "@supabase/supabase-js";
import { rendezvousSchema } from "@/lib/supabase/admin";
import {
  allocateUniqueSlug,
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MEETING_LENGTH_MINUTES,
  DEFAULT_MIN_NOTICE_HOURS,
  DEFAULT_WEEKLY_HOURS,
  displayNameForMember,
  isRendezvousTeamMemberRole,
  slugFromPersonName,
  type TeamMemberProfile,
} from "./schedule-defaults";

export {
  allocateUniqueSlug,
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MEETING_LENGTH_MINUTES,
  DEFAULT_MIN_NOTICE_HOURS,
  DEFAULT_WEEKLY_END,
  DEFAULT_WEEKLY_HOURS,
  DEFAULT_WEEKLY_START,
  displayNameForMember,
  isRendezvousTeamMemberRole,
  slugFromPersonName,
  type TeamMemberProfile,
} from "./schedule-defaults";

export async function listEligibleTeamMembers(
  admin: SupabaseClient
): Promise<TeamMemberProfile[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, first_name, last_name, role, is_active")
    .eq("is_active", true)
    .order("full_name");

  if (error) {
    // Older DBs may lack first/last name columns briefly.
    if (error.message.includes("column")) {
      const fallback = await admin
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("is_active", true)
        .order("full_name");
      if (fallback.error) {
        throw new Error(`profiles read failed: ${fallback.error.message}`);
      }
      return ((fallback.data ?? []) as Array<Record<string, unknown>>)
        .filter((p) => isRendezvousTeamMemberRole(p.role as string | null))
        .map((p) => ({
          id: p.id as string,
          full_name: (p.full_name as string | null) ?? null,
          first_name: null,
          last_name: null,
          role: (p.role as string | null) ?? null,
        }));
    }
    throw new Error(`profiles read failed: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter((p) => isRendezvousTeamMemberRole(p.role as string | null))
    .map((p) => ({
      id: p.id as string,
      full_name: (p.full_name as string | null) ?? null,
      first_name: (p.first_name as string | null) ?? null,
      last_name: (p.last_name as string | null) ?? null,
      role: (p.role as string | null) ?? null,
    }));
}

/**
 * Ensure every eligible Wayfinder team member has a closed schedule with
 * standard defaults (60m / 0 buffer / 24h notice / 14d window / Mon–Fri 9–5).
 */
export async function ensureTeamMemberSchedules(admin: SupabaseClient): Promise<{
  created: number;
}> {
  const members = await listEligibleTeamMembers(admin);
  const db = rendezvousSchema(admin);
  const { data: existing, error } = await db
    .from("staff_schedules")
    .select("id, staff_user_id, slug");
  if (error) {
    throw new Error(`staff_schedules read failed: ${error.message}`);
  }

  const existingByUser = new Map(
    ((existing ?? []) as Array<{ staff_user_id: string; slug: string }>).map((row) => [
      row.staff_user_id,
      row,
    ])
  );
  const takenSlugs = new Set(
    ((existing ?? []) as Array<{ slug: string }>).map((row) => row.slug)
  );

  const missing = members.filter((m) => !existingByUser.has(m.id));
  if (missing.length === 0) return { created: 0 };

  let created = 0;
  for (const member of missing) {
    const slug = allocateUniqueSlug(
      slugFromPersonName({
        firstName: member.first_name,
        lastName: member.last_name,
        fullName: member.full_name,
      }),
      takenSlugs
    );

    const { data: schedule, error: insertErr } = await db
      .from("staff_schedules")
      .insert({
        staff_user_id: member.id,
        slug,
        display_name: displayNameForMember(member),
        enabled: false,
        meeting_length_minutes: DEFAULT_MEETING_LENGTH_MINUTES,
        buffer_minutes: DEFAULT_BUFFER_MINUTES,
        min_notice_hours: DEFAULT_MIN_NOTICE_HOURS,
        booking_window_days: DEFAULT_BOOKING_WINDOW_DAYS,
        timezone: "America/New_York",
      })
      .select("id")
      .single();

    if (insertErr) {
      // Concurrent create / race — skip and continue.
      if (insertErr.message.includes("duplicate") || insertErr.code === "23505") {
        continue;
      }
      throw new Error(`staff_schedules insert failed: ${insertErr.message}`);
    }

    const inserts = DEFAULT_WEEKLY_HOURS.map((wh) => ({
      schedule_id: schedule.id as string,
      day_of_week: wh.dayOfWeek,
      start_time: wh.startTime,
      end_time: wh.endTime,
    }));
    const { error: hoursErr } = await db.from("weekly_hours").insert(inserts);
    if (hoursErr) {
      throw new Error(`weekly_hours insert failed: ${hoursErr.message}`);
    }
    created += 1;
  }

  return { created };
}
