import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  filterProgramGroupsForFieldGate,
  preEtsReleasedAuthorizationGateApplies,
} from "@/lib/pre-ets-field-gate";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "@/lib/pre-ets-service-month";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/program-groups";
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId")?.trim();
  const auth = await requirePreEtsApi(schoolId ? "access" : "supervise");
  if (isPreEtsApiError(auth)) return auth;

  const month = url.searchParams.get("month");
  let serviceMonthFilter: string | null = null;
  if (!isPreEtsServiceMonthFilterOmitted(month)) {
    const parsed = parsePreEtsServiceMonthFilter(month);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    serviceMonthFilter = parsed.serviceMonth;
  }

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

    if (serviceMonthFilter) {
      query = query.eq("service_month", serviceMonthFilter);
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
