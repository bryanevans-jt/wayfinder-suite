import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/authorizations";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId");
  const month = url.searchParams.get("month");
  const studentId = url.searchParams.get("studentId");
  const authType = url.searchParams.get("authType");

  try {
    const admin = createServiceRoleClient();

    if (studentId) {
      const { data: entries } = await admin
        .from("pre_ets_roster_entries")
        .select(
          "id, units_approved, authorization_id, pre_ets_authorizations(id, auth_number, auth_type, service_code, service_month, service_label, school_id, pre_ets_schools(name))"
        )
        .eq("student_id", studentId);

      const { data: ytd } = await admin
        .from("pre_ets_student_ytd_units")
        .select("billable_units, school_year")
        .eq("student_id", studentId)
        .maybeSingle();

      return NextResponse.json({ authorizations: entries ?? [], ytd });
    }

    let query = admin
      .from("pre_ets_authorizations")
      .select(
        "id, auth_number, auth_type, service_code, service_label, service_month, status, school_id, pre_ets_schools(name), pre_ets_program_groups(group_name, instructor_name, class_time)"
      )
      .order("service_month", { ascending: false })
      .limit(100);

    if (schoolId) query = query.eq("school_id", schoolId);
    if (month) {
      const serviceMonth = month.length === 7 ? `${month}-01` : month;
      query = query.eq("service_month", serviceMonth);
    }
    if (authType && authType !== "all") {
      query = query.eq("auth_type", authType);
    }

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ authorizations: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
