import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { seedSessionAttendance } from "@wayfinder/supabase/pre-ets-session-attendance";
import { resolveCoInstructorForSchool, resolvePrimaryInstructorForSchool } from "@wayfinder/supabase/pre-ets-staff-assignments";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/reschedule";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const body = (await request.json()) as {
      reason?: string;
      newSessionDate?: string;
      newStartTime?: string | null;
      newEndTime?: string | null;
    };

    if (!body.reason?.trim()) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }
    if (!body.newSessionDate) {
      return NextResponse.json({ error: "newSessionDate is required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: existing } = await admin
      .from("pre_ets_sessions")
      .select(
        "id, status, authorization_id, school_id, program_group_id, instructor_name, primary_instructor_user_id, co_instructor_user_id"
      )
      .eq("id", sessionId)
      .maybeSingle();

    if (!existing) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (existing.status !== "scheduled") {
      return NextResponse.json(
        { error: "Only scheduled sessions can be rescheduled" },
        { status: 400 }
      );
    }

    const { error: updateErr } = await admin
      .from("pre_ets_sessions")
      .update({
        status: "rescheduled",
        cancelled_reason: body.reason.trim(),
      })
      .eq("id", sessionId);

    if (updateErr) {
      return respondWithLoggedError("staff", route, updateErr, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const assignedInstructor = await resolvePrimaryInstructorForSchool(
      admin,
      existing.school_id as string
    );
    const coInstructor = await resolveCoInstructorForSchool(admin, existing.school_id as string);
    const instructorUserId =
      (existing.primary_instructor_user_id as string | null) ??
      assignedInstructor?.userId ??
      null;
    const coInstructorUserId =
      (existing.co_instructor_user_id as string | null) ?? coInstructor?.userId ?? null;
    const instructorName =
      (existing.instructor_name as string | null) ?? assignedInstructor?.fullName ?? null;

    const { data: replacement, error: insertErr } = await admin
      .from("pre_ets_sessions")
      .insert({
        authorization_id: existing.authorization_id,
        school_id: existing.school_id,
        program_group_id: existing.program_group_id,
        session_date: body.newSessionDate,
        start_time: body.newStartTime ?? null,
        end_time: body.newEndTime ?? null,
        primary_instructor_user_id: instructorUserId,
        co_instructor_user_id: coInstructorUserId,
        instructor_name: instructorName,
        rescheduled_from_session_id: sessionId,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (insertErr || !replacement) {
      return respondWithLoggedError("staff", route, insertErr, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    await admin.from("pre_ets_activity_reports").insert({
      session_id: replacement.id,
      session_date: body.newSessionDate,
      status: "draft",
    });

    await seedSessionAttendance(
      admin,
      replacement.id as string,
      existing.authorization_id as string
    );

    return NextResponse.json({
      ok: true,
      previousSessionId: sessionId,
      newSessionId: replacement.id,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
