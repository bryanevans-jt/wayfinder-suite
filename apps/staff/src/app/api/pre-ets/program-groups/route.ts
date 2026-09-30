import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  filterProgramGroupsForFieldGate,
  preEtsReleasedAuthorizationGateApplies,
} from "@/lib/pre-ets-field-gate";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/program-groups";
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId")?.trim();
  const auth = await requirePreEtsApi(schoolId ? "access" : "supervise");
  if (isPreEtsApiError(auth)) return auth;

  const month = url.searchParams.get("month");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_program_groups")
      .select(
        "id, group_name, frequency, instructor_name, class_time, service_code, service_label, service_month, school_id, hidden_at, pre_ets_schools(name), pre_ets_authorizations(id, auth_number, auth_type, service_code)"
      )
      .is("hidden_at", null)
      .order("service_month", { ascending: false })
      .limit(200);

    if (month) {
      const serviceMonth = month.length === 7 ? `${month}-01` : month;
      query = query.eq("service_month", serviceMonth);
    }
    if (schoolId) {
      query = query.eq("school_id", schoolId);
    }

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    const gate = preEtsReleasedAuthorizationGateApplies(auth.role, auth.settings);
    const groups = filterProgramGroupsForFieldGate(data ?? [], gate);

    return NextResponse.json({ groups });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
