import { requireRendezvousAccess } from "@/lib/session";
import { listTeamCalendarVisibleStaffUserIds } from "@/lib/team-calendar-visibility";
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

  // Service-role for visibility resolution + filtered reads. Never return an
  // unscoped bookings query — staffUserIds is always an explicit allow-list.
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
      bookings: [],
      schedules: [],
      viewer: {
        userId: gate.session.userId,
        role: gate.session.role,
        visibility: visibility.mode,
      },
    });
  }

  const db = rendezvousSchema(admin);
  const { data: bookings, error } = await db
    .from("bookings")
    .select(
      "id, staff_user_id, starts_at, ends_at, counselor_name, meeting_format, location, meet_link, status, reason, notes"
    )
    .eq("status", "confirmed")
    .in("staff_user_id", visibleIds)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  if (error) {
    const message = /invalid api key/i.test(error.message)
      ? "Database key misconfigured. Copy SUPABASE_SERVICE_ROLE_KEY from wayfinder-pro into the rendezvous Vercel project, redeploy, then retry."
      : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // Defense in depth: intersect again in case PostgREST ignores an empty/odd .in().
  const allowed = new Set(visibleIds);
  const scopedBookings = (bookings ?? []).filter((b) =>
    allowed.has(b.staff_user_id as string)
  );

  const staffIds = Array.from(
    new Set(scopedBookings.map((b) => b.staff_user_id as string))
  );
  const { data: profiles } = staffIds.length
    ? await admin.from("profiles").select("id, full_name, role").in("id", staffIds)
    : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Staff"])
  );

  const { data: schedules } = await db
    .from("staff_schedules")
    .select("staff_user_id, display_name, slug, enabled")
    .in("staff_user_id", visibleIds);

  const scopedSchedules = (schedules ?? []).filter((s) =>
    allowed.has(s.staff_user_id as string)
  );

  return NextResponse.json({
    bookings: scopedBookings.map((b) => ({
      ...b,
      staffName: nameById.get(b.staff_user_id as string) ?? "Staff",
    })),
    schedules: scopedSchedules,
    viewer: {
      userId: gate.session.userId,
      role: gate.session.role,
      visibility: visibility.mode,
    },
  });
}
