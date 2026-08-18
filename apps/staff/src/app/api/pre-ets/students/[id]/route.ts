import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/students/[id]";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data: student, error } = await admin
      .from("pre_ets_students")
      .select("id, participant_id, full_name, school_year, primary_school_id")
      .eq("id", id)
      .maybeSingle();

    if (error || !student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    const { data: ytd } = await admin
      .from("pre_ets_student_ytd_units")
      .select("billable_units")
      .eq("student_id", id)
      .maybeSingle();

    const { data: entries } = await admin
      .from("pre_ets_roster_entries")
      .select(
        "id, units_approved, pre_ets_authorizations(id, auth_number, auth_type, service_code, service_month, pre_ets_schools(name))"
      )
      .eq("student_id", id);

    return NextResponse.json({
      student,
      ytdUnits: ytd?.billable_units ?? 0,
      authorizations: entries ?? [],
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
