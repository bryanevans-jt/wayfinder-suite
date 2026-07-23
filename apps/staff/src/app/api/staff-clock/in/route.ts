import { jsonStaffClockError, requireStaffClockSession, staffClockOk } from "@/lib/staff-clock-auth";
import { clockIn } from "@wayfinder/supabase/staff-time-clock";
import { NextResponse } from "next/server";

export async function POST() {
  const route = "api/staff-clock/in";
  try {
    const { admin, userId } = await requireStaffClockSession(true);
    try {
      const shift = await clockIn(admin, userId);
      return staffClockOk({ ok: true, shift });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not clock in";
      const code = (err as { code?: string }).code;
      if (code === "ALREADY_CLOCKED_IN" || message.includes("already clocked in")) {
        return NextResponse.json({ error: "You're already clocked in" }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
