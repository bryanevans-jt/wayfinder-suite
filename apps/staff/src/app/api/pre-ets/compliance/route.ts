import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSessionCompliance } from "@wayfinder/supabase/pre-ets-compliance";
import { loadPreEtsAssignedSchoolIds } from "@wayfinder/supabase/pre-ets-staff-assignments";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/compliance";
  const auth = await requirePreEtsApi("supervise");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const onlyLate = url.searchParams.get("onlyLate") === "1";
  const schoolId = url.searchParams.get("schoolId") ?? undefined;

  try {
    const admin = createServiceRoleClient();
    const assignedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, auth.userId, auth.role);
    const sessions = await loadPreEtsSessionCompliance(admin, {
      schoolId,
      schoolIds: assignedSchoolIds ?? undefined,
      onlyLate,
    });
    return NextResponse.json({ sessions });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
