import { jsonStaffClockError, requireStaffClockSession, staffClockOk } from "@/lib/staff-clock-auth";
import { editShift, listEditLogs, canActorEditShift } from "@wayfinder/supabase/staff-time-clock";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const route = "api/staff-clock/[id]";
  try {
    const { id } = await context.params;
    const { admin, role, userId } = await requireStaffClockSession();
    const { data: shift, error } = await admin
      .from("staff_time_clock_shifts")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      throw error;
    }
    if (!shift) {
      return NextResponse.json({ error: "Shift not found" }, { status: 404 });
    }

    const canView = await canActorEditShift(
      admin,
      { userId, role },
      shift.staff_user_id as string
    );
    if (!canView) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const logs = await listEditLogs(admin, id);
    return staffClockOk({ shift, logs });
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const route = "api/staff-clock/[id]";
  try {
    const { id } = await context.params;
    const { admin, role, userId } = await requireStaffClockSession(true);
    const body = (await request.json()) as {
      clockInAt?: string;
      clockOutAt?: string | null;
      needsAttention?: boolean;
      notes?: string | null;
      reason?: string | null;
    };

    try {
      const shift = await editShift(admin, {
        shiftId: id,
        actorUserId: userId,
        actorRole: role,
        clockInAt: body.clockInAt,
        clockOutAt: body.clockOutAt,
        needsAttention: body.needsAttention,
        notes: body.notes,
        reason: body.reason,
      });
      const logs = await listEditLogs(admin, id);
      return staffClockOk({ ok: true, shift, logs });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update shift";
      if (message === "Forbidden") {
        return NextResponse.json({ error: message }, { status: 403 });
      }
      if (message === "Shift not found") {
        return NextResponse.json({ error: message }, { status: 404 });
      }
      if (message.includes("1 minute")) {
        return NextResponse.json({ error: message }, { status: 400 });
      }
      throw err;
    }
  } catch (error) {
    return jsonStaffClockError(error, route);
  }
}
