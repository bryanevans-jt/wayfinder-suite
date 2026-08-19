import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { seedSessionAttendance } from "@wayfinder/supabase/pre-ets-session-attendance";
import {
  loadPreEtsAssignedSchoolIds,
  resolvePrimaryInstructorForSchool,
} from "@wayfinder/supabase/pre-ets-staff-assignments";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/sessions";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const authorizationId = url.searchParams.get("authorizationId");
  const schoolId = url.searchParams.get("schoolId");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_sessions")
      .select(
        "id, session_date, start_time, end_time, status, instructor_name, authorization_id, school_id, signed_roster_drive_file_id, signed_roster_drive_file_name, signed_roster_uploaded_at, documentation_completed_at, pre_ets_schools(name), pre_ets_authorizations(auth_number, service_code, service_label), pre_ets_activity_reports(status)"
      )
      .order("session_date", { ascending: true })
      .limit(200);

    if (authorizationId) query = query.eq("authorization_id", authorizationId);
    if (schoolId) query = query.eq("school_id", schoolId);

    const assignedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, auth.userId, auth.role);
    if (assignedSchoolIds?.length) {
      query = query.in("school_id", assignedSchoolIds);
    }

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ sessions: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/pre-ets/sessions";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as {
      authorizationId: string;
      sessionDate?: string | null;
      startTime?: string | null;
      endTime?: string | null;
      instructorName?: string | null;
      programGroupId?: string | null;
    };

    if (!body.authorizationId) {
      return NextResponse.json({ error: "authorizationId is required" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: authRow } = await admin
      .from("pre_ets_authorizations")
      .select("school_id, program_group_id")
      .eq("id", body.authorizationId)
      .maybeSingle();

    if (!authRow) {
      return NextResponse.json({ error: "Authorization not found" }, { status: 404 });
    }

    const instructor = body.instructorName
      ? { userId: null as string | null, fullName: body.instructorName }
      : await resolvePrimaryInstructorForSchool(admin, authRow.school_id as string);

    const { data, error } = await admin
      .from("pre_ets_sessions")
      .insert({
        authorization_id: body.authorizationId,
        school_id: authRow.school_id,
        program_group_id: body.programGroupId ?? authRow.program_group_id,
        session_date: body.sessionDate || null,
        start_time: body.startTime || null,
        end_time: body.endTime || null,
        primary_instructor_user_id: instructor?.userId ?? null,
        instructor_name: instructor?.fullName ?? body.instructorName ?? null,
        status: "scheduled",
      })
      .select("id")
      .single();

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    await admin.from("pre_ets_activity_reports").insert({
      session_id: data.id,
      session_date: body.sessionDate || null,
      status: "draft",
    });

    await seedSessionAttendance(admin, data.id as string, body.authorizationId);

    return NextResponse.json({ sessionId: data.id });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
