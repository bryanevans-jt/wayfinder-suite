import { requireRendezvousAccess } from "@/lib/session";
import { createAdminClient, createUserDb } from "@/lib/supabase/admin";
import { isValidSlug } from "@/lib/scheduling/slug";
import {
  DEFAULT_BOOKING_WINDOW_DAYS,
  DEFAULT_BUFFER_MINUTES,
  DEFAULT_MEETING_LENGTH_MINUTES,
  DEFAULT_MIN_NOTICE_HOURS,
  DEFAULT_WEEKLY_HOURS,
  displayNameForMember,
  isRendezvousTeamMemberRole,
  slugFromPersonName,
} from "@/lib/scheduling/schedule-defaults";
import { NextResponse } from "next/server";

export async function GET() {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    return NextResponse.json({ error: "Not found" }, { status: gate.status });
  }

  const { db } = await createUserDb();
  const { data: schedules, error } = await db
    .from("staff_schedules")
    .select("*")
    .order("slug");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (schedules ?? []).map((s) => s.id as string);
  const { data: hours } = ids.length
    ? await db.from("weekly_hours").select("*").in("schedule_id", ids)
    : { data: [] };

  return NextResponse.json({
    schedules: schedules ?? [],
    weeklyHours: hours ?? [],
  });
}

export async function POST(request: Request) {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    return NextResponse.json({ error: "Not found" }, { status: gate.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const staffUserId = typeof body.staffUserId === "string" ? body.staffUserId : "";
  if (!staffUserId) {
    return NextResponse.json({ error: "staffUserId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { db } = await createUserDb();
  const { data: profile } = await admin
    .from("profiles")
    .select("id, full_name, first_name, last_name, role")
    .eq("id", staffUserId)
    .maybeSingle();
  if (!profile) {
    return NextResponse.json({ error: "Team member profile not found" }, { status: 404 });
  }
  if (!isRendezvousTeamMemberRole(profile.role as string | null)) {
    return NextResponse.json(
      { error: "Schedules are only for Wayfinder team members" },
      { status: 400 }
    );
  }

  const member = {
    id: profile.id as string,
    full_name: (profile.full_name as string | null) ?? null,
    first_name: (profile.first_name as string | null) ?? null,
    last_name: (profile.last_name as string | null) ?? null,
    role: (profile.role as string | null) ?? null,
  };

  const slug =
    typeof body.slug === "string" && body.slug.trim()
      ? body.slug.trim().toLowerCase()
      : slugFromPersonName({
          firstName: member.first_name,
          lastName: member.last_name,
          fullName: member.full_name,
        });
  if (!isValidSlug(slug)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  const weeklyHours = Array.isArray(body.weeklyHours)
    ? body.weeklyHours
    : DEFAULT_WEEKLY_HOURS;

  const row = {
    staff_user_id: staffUserId,
    slug,
    display_name:
      typeof body.displayName === "string" && body.displayName.trim()
        ? body.displayName.trim()
        : displayNameForMember(member),
    enabled: body.enabled === true,
    meeting_length_minutes:
      typeof body.meetingLengthMinutes === "number"
        ? body.meetingLengthMinutes
        : DEFAULT_MEETING_LENGTH_MINUTES,
    buffer_minutes:
      typeof body.bufferMinutes === "number" ? body.bufferMinutes : DEFAULT_BUFFER_MINUTES,
    min_notice_hours:
      typeof body.minNoticeHours === "number"
        ? body.minNoticeHours
        : DEFAULT_MIN_NOTICE_HOURS,
    booking_window_days:
      typeof body.bookingWindowDays === "number"
        ? body.bookingWindowDays
        : DEFAULT_BOOKING_WINDOW_DAYS,
    default_location:
      typeof body.defaultLocation === "string" ? body.defaultLocation.trim() : null,
    timezone:
      typeof body.timezone === "string" && body.timezone.trim()
        ? body.timezone.trim()
        : "America/New_York",
  };

  const { data: schedule, error } = await db
    .from("staff_schedules")
    .upsert(row, { onConflict: "staff_user_id" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await db.from("weekly_hours").delete().eq("schedule_id", schedule.id);

  const inserts = weeklyHours
    .map((wh) => {
      const rec = wh as Record<string, unknown>;
      return {
        schedule_id: schedule.id as string,
        day_of_week: Number(rec.dayOfWeek),
        start_time: String(rec.startTime),
        end_time: String(rec.endTime),
      };
    })
    .filter(
      (wh) =>
        Number.isFinite(wh.day_of_week) &&
        wh.day_of_week >= 0 &&
        wh.day_of_week <= 6 &&
        wh.start_time &&
        wh.end_time
    );
  if (inserts.length) {
    const { error: hoursErr } = await db.from("weekly_hours").insert(inserts);
    if (hoursErr) {
      return NextResponse.json({ error: hoursErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, schedule });
}

export async function PATCH(request: Request) {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    return NextResponse.json({ error: "Not found" }, { status: gate.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body?.enabled === "boolean") patch.enabled = body.enabled;
  if (typeof body?.displayName === "string") patch.display_name = body.displayName.trim();
  if (typeof body?.slug === "string") {
    const slug = body.slug.trim().toLowerCase();
    if (!isValidSlug(slug)) {
      return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
    }
    patch.slug = slug;
  }
  if (typeof body?.meetingLengthMinutes === "number") {
    patch.meeting_length_minutes = body.meetingLengthMinutes;
  }
  if (typeof body?.bufferMinutes === "number") patch.buffer_minutes = body.bufferMinutes;
  if (typeof body?.minNoticeHours === "number") patch.min_notice_hours = body.minNoticeHours;
  if (typeof body?.bookingWindowDays === "number") {
    patch.booking_window_days = body.bookingWindowDays;
  }
  if (typeof body?.defaultLocation === "string") {
    patch.default_location = body.defaultLocation.trim();
  }
  if (typeof body?.timezone === "string") patch.timezone = body.timezone.trim();

  const { db } = await createUserDb();
  const { data, error } = await db
    .from("staff_schedules")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (Array.isArray(body?.weeklyHours)) {
    await db.from("weekly_hours").delete().eq("schedule_id", id);
    const inserts = body.weeklyHours
      .map((wh) => {
        const rec = wh as Record<string, unknown>;
        return {
          schedule_id: id,
          day_of_week: Number(rec.dayOfWeek),
          start_time: String(rec.startTime),
          end_time: String(rec.endTime),
        };
      })
      .filter((wh) => Number.isFinite(wh.day_of_week));
    if (inserts.length) {
      const { error: hoursErr } = await db.from("weekly_hours").insert(inserts);
      if (hoursErr) {
        return NextResponse.json({ error: hoursErr.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true, schedule: data });
}
