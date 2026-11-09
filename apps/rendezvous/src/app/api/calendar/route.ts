import { requireRendezvousAccess } from "@/lib/session";
import { listVisibleStaffUserIds } from "@/lib/access";
import { createUserDb } from "@/lib/supabase/admin";
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

  const { supabase, db } = await createUserDb();
  const visible = await listVisibleStaffUserIds(supabase, {
    userId: gate.session.userId,
    role: gate.session.role,
  });

  let query = db
    .from("bookings")
    .select(
      "id, staff_user_id, starts_at, ends_at, counselor_name, meeting_format, location, meet_link, status, reason, notes"
    )
    .eq("status", "confirmed")
    .gte("starts_at", from)
    .lt("starts_at", to)
    .order("starts_at");

  if (visible !== "all") {
    query = query.in("staff_user_id", visible);
  }

  const { data: bookings, error } = await query;
  if (error) {
    const message =
      /invalid api key/i.test(error.message)
        ? "Database key misconfigured. Copy SUPABASE_SERVICE_ROLE_KEY from wayfinder-pro into the rendezvous Vercel project, redeploy, then retry."
        : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const staffIds = Array.from(
    new Set((bookings ?? []).map((b) => b.staff_user_id as string))
  );
  const { data: profiles } = staffIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", staffIds)
    : { data: [] };

  const nameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, (p.full_name as string) || "Staff"])
  );

  const { data: schedules } = await db
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
