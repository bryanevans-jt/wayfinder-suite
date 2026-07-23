import { jsonStaffClockError, requireStaffClockSession, staffClockOk } from "@/lib/staff-clock-auth";
import { acknowledgeStillWorking } from "@wayfinder/supabase/staff-time-clock";
import { NextResponse } from "next/server";

export async function POST() {
  const route = "api/staff-clock/still-working";
  try {
    const { admin, userId } = await requireStaffClockSession(true);
    try {
      const shift = await acknowledgeStillWorking(admin, userId);
      return staffClockOk({ ok: true, shift });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save response";
      if (message.includes("not clocked in")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
