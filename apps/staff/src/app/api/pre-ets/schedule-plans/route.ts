import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { expandPreEtsScheduleDates } from "@wayfinder/supabase/pre-ets-schedule-plans";
import { seedSessionAttendance } from "@wayfinder/supabase/pre-ets-session-attendance";
import { resolveCoInstructorForSchool, resolvePrimaryInstructorForSchool } from "@wayfinder/supabase/pre-ets-staff-assignments";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/schedule-plans";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const programGroupId = url.searchParams.get("programGroupId");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_schedule_plans")
      .select(
        "id, plan_type, recurrence_rule, excluded_months, planned_service_code, start_date, end_date, created_at, program_group_id"
      )
      .order("created_at", { ascending: false })
      .limit(50);

    if (programGroupId) query = query.eq("program_group_id", programGroupId);

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ plans: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/pre-ets/schedule-plans";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const body = (await request.json()) as {
      programGroupId: string;
      planType: "recurring" | "monthly" | "custom" | "intensive";
      recurrenceRule?: Record<string, unknown>;
      excludedMonths?: string[];
      plannedServiceCode?: string | null;
      startDate?: string | null;
      endDate?: string | null;
      sessionDates?: string[];
    };

    if (!body.programGroupId || !body.planType) {
      return NextResponse.json({ error: "programGroupId and planType required" }, { status: 400 });
    }

    const dates = expandPreEtsScheduleDates({
      planType: body.planType,
      recurrenceRule: body.recurrenceRule,
      excludedMonths: body.excludedMonths,
      startDate: body.startDate,
      endDate: body.endDate,
      sessionDates: body.sessionDates,
    });

    const admin = createServiceRoleClient();

    const { data: plan, error: planErr } = await admin
      .from("pre_ets_schedule_plans")
      .insert({
        program_group_id: body.programGroupId,
        plan_type: body.planType,
        recurrence_rule: body.recurrenceRule ?? {},
        excluded_months: body.excludedMonths ?? [],
        planned_service_code: body.plannedServiceCode ?? null,
        start_date: body.startDate ?? null,
        end_date: body.endDate ?? null,
      })
      .select("id")
      .single();

    if (planErr || !plan) {
      return respondWithLoggedError("staff", route, planErr, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const { data: group } = await admin
      .from("pre_ets_program_groups")
      .select("school_id, instructor_name, service_code, service_label")
      .eq("id", body.programGroupId)
      .maybeSingle();

    const { data: auths } = await admin
      .from("pre_ets_authorizations")
      .select("id, auth_type")
      .eq("program_group_id", body.programGroupId);

    const groupAuth = auths?.find((a) => a.auth_type === "group");
    const authId = (groupAuth?.id ?? auths?.[0]?.id) as string | undefined;
    if (!authId || !group) {
      return NextResponse.json({ planId: plan.id, sessionsCreated: 0, sessionDates: dates });
    }

    const assignedInstructor = await resolvePrimaryInstructorForSchool(
      admin,
      group.school_id as string
    );
    const coInstructor = await resolveCoInstructorForSchool(admin, group.school_id as string);
    const instructorName = assignedInstructor?.fullName ?? group.instructor_name;
    const instructorUserId = assignedInstructor?.userId ?? null;

    let created = 0;
    for (const d of dates) {
      const { data: sess } = await admin
        .from("pre_ets_sessions")
        .insert({
          authorization_id: authId,
          school_id: group.school_id,
          program_group_id: body.programGroupId,
          session_date: d,
          primary_instructor_user_id: instructorUserId,
          co_instructor_user_id: coInstructor?.userId ?? null,
          instructor_name: instructorName,
          status: "scheduled",
        })
        .select("id")
        .single();

      if (sess?.id) {
        await admin.from("pre_ets_activity_reports").insert({
          session_id: sess.id,
          session_date: d,
          status: "draft",
        });
        await seedSessionAttendance(admin, sess.id as string, authId);
        created++;
      }
    }

    return NextResponse.json({
      planId: plan.id,
      sessionsCreated: created,
      sessionDates: dates,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
