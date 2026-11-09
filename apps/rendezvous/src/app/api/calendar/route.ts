import { requireRendezvousAccess } from "@/lib/session";
import { listVisibleStaffUserIds } from "@/lib/access";
import { createAdminClient, rendezvousSchema } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  const visible = await listVisibleStaffUserIds(admin, {
    userId: gate.session.userId,
    role: gate.session.role,
  });

  let query = rendezvousSchema(admin)
    .from("bookings")
    .select(
      "id, staff_user_id, starts_at, ends_at, counselor_name, meeting_format, location, meet_link, status, reason"
    )
    .eq("status", "confirmed")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  if (visible !== "all") {
    query = query.in("staff_user_id", visible);
  }

  const { data: bookings, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const staffIds = Array.from(
    new Set((bookings ?? []).map((b) => b.staff_user_id as string))
  );
  const { data: profiles } = staffIds.length
    ? await admin.from("profiles").select("id, full_name, role").in("id", staffIds)
    : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Staff"])
  );

  const { data: schedules } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("staff_user_id, display_name, slug, enabled");

  return NextResponse.json({
    bookings: (bookings ?? []).map((b) => ({
      ...b,
      staffName: nameById.get(b.staff_user_id as string) ?? "Staff",
    })),
    schedules: schedules ?? [],
    viewer: {
      userId: gate.session.userId,
      role: gate.session.role,
      visibility: visible === "all" ? "all" : "scoped",
    },
  });
}
