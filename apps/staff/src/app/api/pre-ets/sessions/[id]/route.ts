import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as {
      sessionDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      status?: string;
      cancelledReason?: string | null;
      instructorName?: string | null;
    };

    const patch: Record<string, unknown> = {};
    if (body.sessionDate !== undefined) patch.session_date = body.sessionDate;
    if (body.startTime !== undefined) patch.start_time = body.startTime;
    if (body.endTime !== undefined) patch.end_time = body.endTime;
    if (body.status !== undefined) patch.status = body.status;
    if (body.cancelledReason !== undefined) patch.cancelled_reason = body.cancelledReason;
    if (body.instructorName !== undefined) patch.instructor_name = body.instructorName;

    const admin = createServiceRoleClient();
    const { error } = await admin.from("pre_ets_sessions").update(patch).eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    if (body.sessionDate !== undefined) {
      await admin
        .from("pre_ets_activity_reports")
        .update({ session_date: body.sessionDate, updated_at: new Date().toISOString() })
        .eq("session_id", id);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
