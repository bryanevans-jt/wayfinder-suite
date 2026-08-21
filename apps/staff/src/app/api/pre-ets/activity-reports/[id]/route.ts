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
    const admin = createServiceRoleClient();

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

    if (body.participant_count !== undefined) {
      const raw = body.participant_count;
      if (raw === null || raw === "") {
        patch.participant_count = null;
      } else {
        const n = typeof raw === "number" ? raw : Number(raw);
        patch.participant_count = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : null;
      }
    }

    if (body.signature_data !== undefined) {
      const raw = typeof body.signature_data === "string" ? body.signature_data.trim() : "";
      if (!raw) {
        patch.signature_data = null;
      } else if (!raw.startsWith("data:image/")) {
        return NextResponse.json({ error: "Invalid signature image data." }, { status: 400 });
      } else {
        patch.signature_data = raw;
      }
    }

    if (body.signed_date !== undefined) {
      const raw =
        body.signed_date === null || body.signed_date === ""
          ? null
          : String(body.signed_date).trim().slice(0, 10);
      patch.signed_date = raw;
    }

    const submitting = body.status === "submitted" || body.status === "late_submitted";
    if (submitting) {
      const { data: existing } = await admin
        .from("pre_ets_activity_reports")
        .select("signature_data, signed_date, session_id, session_date")
        .eq("id", id)
        .maybeSingle();

      const signature =
        (typeof patch.signature_data === "string" ? patch.signature_data : null) ??
        (existing?.signature_data as string | null) ??
        null;
      const signedDate =
        (typeof patch.signed_date === "string" ? patch.signed_date : null) ??
        (existing?.signed_date as string | null) ??
        null;

      if (!signature?.startsWith("data:image/")) {
        return NextResponse.json(
          { error: "Instructor signature is required to submit the Class Activity Report." },
          { status: 400 }
        );
      }
      if (!signedDate) {
        return NextResponse.json(
          { error: "Signed date is required to submit the Class Activity Report." },
          { status: 400 }
        );
      }

      patch.submitted_at = new Date().toISOString();

      if (existing?.session_id && body.status === "submitted") {
        const { data: session } = await admin
          .from("pre_ets_sessions")
          .select("session_date")
          .eq("id", existing.session_id)
          .maybeSingle();

        const sessionDate =
          (body.session_date as string) ||
          (existing.session_date as string) ||
          (session?.session_date as string);
        if (sessionDate) {
          const deadlineMs = auth.settings.submission_deadline_hours * 60 * 60 * 1000;
          const dueAt = new Date(`${sessionDate}T23:59:59.000Z`).getTime() + deadlineMs;
          if (Date.now() > dueAt) {
            patch.status = "late_submitted";
          }
        }
      }
    }

    const { error } = await admin.from("pre_ets_activity_reports").update(patch).eq("id", id);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    if (patch.status === "submitted" || patch.status === "late_submitted") {
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
