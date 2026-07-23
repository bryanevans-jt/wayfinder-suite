import { jsonStaffClockError, requireStaffClockSession, staffClockOk } from "@/lib/staff-clock-auth";
import { clockOut } from "@wayfinder/supabase/staff-time-clock";
import { NextResponse } from "next/server";

export async function POST() {
  const route = "api/staff-clock/clock-out";
  try {
    const { admin, userId } = await requireStaffClockSession(true);
    try {
      const shift = await clockOut(admin, userId);
      return staffClockOk({ ok: true, shift });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not clock out";
      if (message.includes("not clocked in") || message.includes("1 minute")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
