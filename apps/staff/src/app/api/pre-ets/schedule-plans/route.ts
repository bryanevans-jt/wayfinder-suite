import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

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
      .select("id")
      .eq("program_group_id", body.programGroupId)
      .eq("auth_type", "group")
      .limit(1);

    const authId = auths?.[0]?.id as string | undefined;
    if (!authId || !group) {
      return NextResponse.json({ planId: plan.id, sessionsCreated: 0 });
    }

    const dates = body.sessionDates ?? [];
    let created = 0;
    for (const d of dates) {
      const { data: sess } = await admin
        .from("pre_ets_sessions")
        .insert({
          authorization_id: authId,
          school_id: group.school_id,
          program_group_id: body.programGroupId,
          session_date: d,
          instructor_name: group.instructor_name,
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
        created++;
      }
    }

    return NextResponse.json({ planId: plan.id, sessionsCreated: created });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
