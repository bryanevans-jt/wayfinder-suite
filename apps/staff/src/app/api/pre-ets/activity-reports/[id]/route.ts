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

      const admin = createServiceRoleClient();
      const { data: report } = await admin
        .from("pre_ets_activity_reports")
        .select("session_id, session_date")
        .eq("id", id)
        .maybeSingle();

      if (report?.session_id && body.status === "submitted") {
        const { data: session } = await admin
          .from("pre_ets_sessions")
          .select("session_date")
          .eq("id", report.session_id)
          .maybeSingle();

        const sessionDate = (body.session_date as string) || (session?.session_date as string);
        if (sessionDate) {
          const deadlineMs = auth.settings.submission_deadline_hours * 60 * 60 * 1000;
          const dueAt = new Date(`${sessionDate}T23:59:59.000Z`).getTime() + deadlineMs;
          if (Date.now() > dueAt) {
            patch.status = "late_submitted";
          }
        }
      }
    }

    const admin = createServiceRoleClient();
    const { error } = await admin.from("pre_ets_activity_reports").update(patch).eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    if (
      patch.status === "submitted" ||
      patch.status === "late_submitted"
    ) {
      const { data: report } = await admin
        .from("pre_ets_activity_reports")
        .select("session_id")
        .eq("id", id)
        .maybeSingle();

      if (report?.session_id) {
        const { maybeCompleteSessionDocumentation } = await import(
          "@wayfinder/supabase/pre-ets-session-attendance"
        );
        await maybeCompleteSessionDocumentation(
          admin,
          report.session_id as string,
          auth.settings.school_year
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
