import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { seedSessionAttendance } from "@wayfinder/supabase/pre-ets-session-attendance";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/attendance";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data: session } = await admin
      .from("pre_ets_sessions")
      .select("authorization_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (!session?.authorization_id) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    await seedSessionAttendance(admin, sessionId, session.authorization_id as string);

    const { data, error } = await admin
      .from("pre_ets_session_attendance")
      .select(
        "id, present, signed_on_roster, student_id, pre_ets_students(participant_id, full_name)"
      )
      .eq("session_id", sessionId)
      .order("student_id");

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ attendance: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/attendance";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId } = await context.params;

  try {
    const body = (await request.json()) as {
      rows: { id: string; present: boolean; signedOnRoster: boolean }[];
      finalize?: boolean;
      schoolYear?: string;
    };

    const admin = createServiceRoleClient();

    for (const row of body.rows ?? []) {
      await admin
        .from("pre_ets_session_attendance")
        .update({
          present: row.present,
          signed_on_roster: row.signedOnRoster,
        })
        .eq("id", row.id)
        .eq("session_id", sessionId);
    }

    if (body.finalize) {
      const { maybeCompleteSessionDocumentation } = await import(
        "@wayfinder/supabase/pre-ets-session-attendance"
      );
      if (body.schoolYear) {
        await maybeCompleteSessionDocumentation(admin, sessionId, body.schoolYear);
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
