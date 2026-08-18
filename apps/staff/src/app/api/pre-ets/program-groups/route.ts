import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/program-groups";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const month = url.searchParams.get("month");

  try {
    const admin = createServiceRoleClient();
    let query = admin
      .from("pre_ets_program_groups")
      .select(
        "id, group_name, frequency, instructor_name, class_time, service_code, service_label, service_month, school_id, pre_ets_schools(name), pre_ets_authorizations(id, auth_number, auth_type, service_code)"
      )
      .order("service_month", { ascending: false })
      .limit(100);

    if (month) {
      const serviceMonth = month.length === 7 ? `${month}-01` : month;
      query = query.eq("service_month", serviceMonth);
    }

    const { data, error } = await query;
    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ groups: data ?? [] });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
