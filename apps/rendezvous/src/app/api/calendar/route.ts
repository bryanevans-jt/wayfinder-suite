import { requireRendezvousAccess } from "@/lib/session";
import { buildTeamCalendarStaffDirectory } from "@/lib/team-calendar-staff";
import { listTeamCalendarVisibleStaffUserIds } from "@/lib/team-calendar-visibility";
import {
  collectScopedTeamCalendarEvents,
  type RendezvousBookingPayload,
} from "@/lib/team-calendar-events";
import { getCalendarEventsCached, getStaffEmail } from "@/lib/db";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { rendezvousSchema } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const gate = await requireRendezvousAccess();
  if (!gate.ok) {
    return NextResponse.json({ error: "Not found" }, { status: gate.status });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to are required" }, { status: 400 });
  }

  const timeMin = new Date(from);
  const timeMax = new Date(to);
  if (Number.isNaN(timeMin.getTime()) || Number.isNaN(timeMax.getTime()) || timeMin >= timeMax) {
    return NextResponse.json({ error: "from and to must be valid ISO range" }, { status: 400 });
  }

  // Service-role for visibility resolution + filtered reads. Never return an
  // unscoped events query — staffUserIds is always an explicit allow-list.
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      {
        error:
          "Database key misconfigured. Copy SUPABASE_SERVICE_ROLE_KEY from wayfinder-pro into the rendezvous Vercel project, redeploy, then retry.",
      },
      { status: 500 }
    );
  }

  const visibility = await listTeamCalendarVisibleStaffUserIds(admin, {
    userId: gate.session.userId,
    role: gate.session.role,
  });
  const visibleIds = visibility.staffUserIds;
  if (visibleIds.length === 0) {
    return NextResponse.json({
      events: [],
      bookings: [],
      schedules: [],
      staff: [],
      errors: [],
      viewer: {
        userId: gate.session.userId,
        role: gate.session.role,
        visibility: visibility.mode,
      },
    });
  }

  const db = rendezvousSchema(admin);
  const allowed = new Set(visibleIds);

  const { data: bookings, error } = await db
    .from("bookings")
    .select(
      "id, staff_user_id, starts_at, ends_at, counselor_name, meeting_format, location, meet_link, status, reason, notes, google_event_id"
    )
    .eq("status", "confirmed")
    .in("staff_user_id", visibleIds)
    .lt("starts_at", to)
    .gt("ends_at", from)
    .order("starts_at");

  if (error) {
    const message = /invalid api key/i.test(error.message)
      ? "Database key misconfigured. Copy SUPABASE_SERVICE_ROLE_KEY from wayfinder-pro into the rendezvous Vercel project, redeploy, then retry."
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const scopedBookings = ((bookings ?? []) as RendezvousBookingPayload[]).filter((b) =>
    allowed.has(b.staff_user_id)
  );

  const { data: schedules } = await db
    .from("staff_schedules")
    .select("staff_user_id, display_name, slug, enabled, google_calendar_id")
    .in("staff_user_id", visibleIds);

  const scopedSchedules = (schedules ?? []).filter((s) =>
    allowed.has(s.staff_user_id as string)
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role")
    .in("id", visibleIds);

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Staff"])
  );

  const bookingStaffNames = new Map<string, string>();
  for (const b of scopedBookings) {
    const id = b.staff_user_id;
    bookingStaffNames.set(id, nameById.get(id) ?? "Staff");
  }

  const staff = buildTeamCalendarStaffDirectory({
    visibleStaffUserIds: visibleIds,
    schedules: scopedSchedules,
    bookingStaffNames,
    profileNames: nameById,
  });

  const calendarIdByStaff = new Map<string, string>();
  for (const s of scopedSchedules) {
    calendarIdByStaff.set(
      s.staff_user_id as string,
      ((s.google_calendar_id as string) || "primary").trim() || "primary"
    );
  }

  const bookingsByStaff = new Map<string, RendezvousBookingPayload[]>();
  for (const b of scopedBookings) {
    const list = bookingsByStaff.get(b.staff_user_id) ?? [];
    list.push(b);
    bookingsByStaff.set(b.staff_user_id, list);
  }

  type PersonError = { staffUserId: string; staffName: string; message: string };
  const errors: PersonError[] = [];

  const perStaff = await Promise.all(
    visibleIds.map(async (staffUserId) => {
      const staffName = nameById.get(staffUserId) ?? "Staff";
      const personBookings = bookingsByStaff.get(staffUserId) ?? [];
      let googleEvents: Awaited<ReturnType<typeof getCalendarEventsCached>> = [];

      try {
        const identity = await getStaffEmail(admin, staffUserId);
        if (!identity?.email) {
          errors.push({
            staffUserId,
            staffName,
            message: "No Google Workspace email on file",
          });
        } else {
          googleEvents = await getCalendarEventsCached({
            admin,
            staffUserId,
            staffEmail: identity.email,
            calendarId: calendarIdByStaff.get(staffUserId) ?? "primary",
            timeMin,
            timeMax,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load Google Calendar";
        console.error(`Team Calendar Google fetch failed for ${staffUserId}:`, err);
        errors.push({ staffUserId, staffName, message });
      }

      return {
        staffUserId,
        staffName,
        bookings: personBookings,
        googleEvents,
      };
    })
  );

  const events = collectScopedTeamCalendarEvents({
    allowedStaffUserIds: visibleIds,
    perStaff,
  });

  return NextResponse.json({
    events,
    // Keep bookings for older clients / tests; same scoped set used for merge.
    bookings: scopedBookings.map((b) => ({
      ...b,
      staffName: nameById.get(b.staff_user_id) ?? "Staff",
    })),
    schedules: scopedSchedules.map((s) => ({
      staff_user_id: s.staff_user_id,
      display_name: s.display_name,
      slug: s.slug,
      enabled: s.enabled,
    })),
    staff,
    errors,
    viewer: {
      userId: gate.session.userId,
      role: gate.session.role,
      visibility: visibility.mode,
    },
  });
}
