import { jsonStaffClockError, requireStaffClockSession, staffClockOk } from "@/lib/staff-clock-auth";
import { loadStaffNameById } from "@/lib/operations-data";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import {
  applyMidnightSplitIfNeeded,
  listOpenShiftsForUsers,
  shiftDurationMinutes,
} from "@wayfinder/supabase/staff-time-clock";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/staff-clock/team";
  try {
    const { admin, role, userId } = await requireStaffClockSession();
    if (!isSupervisorRole(role) && !isAdminTierRole(role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let staffIds: string[] = [];
    if (isAdminTierRole(role)) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, role")
        .eq("is_active", true)
        .in("role", [
          "es",
          "supervisor",
          "admin",
          "super_admin",
          "accountant",
          "hr",
          "hospitality_specialist",
        ]);
      staffIds = (profiles ?? []).map((p) => p.id as string);
    } else {
      const scope = await loadSupervisorScope(admin, userId);
      staffIds = [...new Set([userId, ...scope.esUserIds])];
    }

    // Repair midnight splits for open team members before listing
    for (const id of staffIds) {
      await applyMidnightSplitIfNeeded(admin, id);
    }

    const openShifts = await listOpenShiftsForUsers(admin, staffIds);
    const openIds = openShifts.map((s) => s.staff_user_id);
    const nameById = await loadStaffNameById(admin, openIds, "Team member");

    const now = new Date();
    const clockedIn = openShifts
      .map((s) => ({
        staffUserId: s.staff_user_id,
        name: nameById.get(s.staff_user_id) ?? "Team member",
        shiftId: s.id,
        clockInAt: s.clock_in_at,
        localDate: s.local_date,
        minutesSoFar: shiftDurationMinutes(s.clock_in_at, null, now),
        stillWorkingPromptPending: Boolean(
          s.still_working_prompted_at && !s.still_working_ack_at
        ),
        needsAttention: s.needs_attention,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const { data: attentionRows } = await admin
      .from("staff_time_clock_shifts")
      .select("id, staff_user_id, local_date, clock_in_at, clock_out_at, auto_out_reason")
      .in("staff_user_id", staffIds)
      .eq("needs_attention", true)
      .order("clock_in_at", { ascending: false })
      .limit(50);

    const attentionStaffIds = [
      ...new Set((attentionRows ?? []).map((r) => r.staff_user_id as string)),
    ];
    const attentionNames = await loadStaffNameById(admin, attentionStaffIds, "Team member");

    const attention = (attentionRows ?? []).map((r) => ({
      shiftId: r.id as string,
      staffUserId: r.staff_user_id as string,
      name: attentionNames.get(r.staff_user_id as string) ?? "Team member",
      localDate: r.local_date as string,
      clockInAt: r.clock_in_at as string,
      clockOutAt: (r.clock_out_at as string | null) ?? null,
      autoOutReason: (r.auto_out_reason as string | null) ?? null,
    }));

    return staffClockOk({ clockedIn, attention });
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
