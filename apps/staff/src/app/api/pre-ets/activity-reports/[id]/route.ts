import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/activity-reports/[id]";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const fields = [
      "session_date",
      "lesson_topic",
      "learning_objective",
      "lesson_structure",
      "students_on_time",
      "students_engaged",
      "students_participated",
      "students_disruptive",
      "faculty_present",
      "additional_notes",
      "status",
    ] as const;

    for (const f of fields) {
      if (body[f] !== undefined) patch[f] = body[f];
    }

    if (body.status === "submitted" || body.status === "late_submitted") {
      patch.submitted_at = new Date().toISOString();
    }

    const admin = createServiceRoleClient();
    const { error } = await admin.from("pre_ets_activity_reports").update(patch).eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
