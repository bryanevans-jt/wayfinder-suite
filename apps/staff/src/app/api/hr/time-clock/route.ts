import { loadStaffNameById } from "@/lib/staff-names";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, isHrRole } from "@wayfinder/supabase/roles";
import {
  applyMidnightSplitIfNeeded,
  canUseStaffClock,
  listOpenShiftsForUsers,
  localDateStringInTz,
  minutesToClockLabel,
  shiftDurationMinutes,
} from "@wayfinder/supabase/staff-time-clock";
import { NextResponse } from "next/server";

function calendarWeekStartSunday(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - utc.getUTCDay());
  return utc.toISOString().slice(0, 10);
}

function calendarWeekEndSaturday(weekStart: string): string {
  const [y, m, d] = weekStart.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + 6));
  return utc.toISOString().slice(0, 10);
}

function addCalendarDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d + days));
  return utc.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.effectiveRole ?? "";
  if (!isHrRole(role) && !isAdminTierRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const requestedWeek = url.searchParams.get("week");
  const etToday = localDateStringInTz(new Date());
  const weekStart = calendarWeekStartSunday(
    requestedWeek && /^\d{4}-\d{2}-\d{2}$/.test(requestedWeek) ? requestedWeek : etToday
  );
  const weekEnd = calendarWeekEndSaturday(weekStart);

  const admin = createServiceRoleClient();
  const { data: profiles, error: profileError } = await admin
    .from("profiles")
    .select("id, role")
    .eq("is_active", true);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const staffIds = (profiles ?? [])
    .filter((p) => canUseStaffClock((p.role as string | null) ?? null))
    .map((p) => p.id as string);

  for (const id of staffIds) {
    await applyMidnightSplitIfNeeded(admin, id);
  }

  const now = new Date();
  const openShifts = await listOpenShiftsForUsers(admin, staffIds);
  const openByUser = new Map(openShifts.map((s) => [s.staff_user_id, s]));

  const { data: weekShifts, error: shiftError } = staffIds.length
    ? await admin
        .from("staff_time_clock_shifts")
        .select("staff_user_id, clock_in_at, clock_out_at")
        .in("staff_user_id", staffIds)
        .gte("local_date", weekStart)
        .lte("local_date", weekEnd)
    : { data: [] as { staff_user_id: string; clock_in_at: string; clock_out_at: string | null }[], error: null };
  if (shiftError) {
    return NextResponse.json({ error: shiftError.message }, { status: 500 });
  }

  const minutesByUser = new Map<string, number>();
  for (const id of staffIds) minutesByUser.set(id, 0);
  for (const row of weekShifts ?? []) {
    const userId = row.staff_user_id as string;
    const minutes = shiftDurationMinutes(
      row.clock_in_at as string,
      (row.clock_out_at as string | null) ?? null,
      now
    );
    minutesByUser.set(userId, (minutesByUser.get(userId) ?? 0) + minutes);
  }

  const nameById = await loadStaffNameById(admin, staffIds, "Staff");

  const signedIn = openShifts
    .map((s) => ({
      staffUserId: s.staff_user_id,
      name: nameById.get(s.staff_user_id) ?? "Staff",
      clockInAt: s.clock_in_at,
      minutesSoFar: shiftDurationMinutes(s.clock_in_at, null, now),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const hours = staffIds
    .map((id) => {
      const minutes = minutesByUser.get(id) ?? 0;
      return {
        staffUserId: id,
        name: nameById.get(id) ?? "Staff",
        minutes,
        hoursLabel: minutesToClockLabel(minutes),
        signedIn: openByUser.has(id),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const weekOptions = Array.from({ length: 12 }, (_, i) => {
    const start = addCalendarDays(calendarWeekStartSunday(etToday), -7 * i);
    return { weekStart: start, weekEnd: calendarWeekEndSaturday(start) };
  });

  return NextResponse.json({
    weekStart,
    weekEnd,
    weekOptions,
    signedIn,
    hours,
  });
}
