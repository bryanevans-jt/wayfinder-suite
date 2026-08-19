import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSessionCompliance } from "@wayfinder/supabase/pre-ets-compliance";
import {
  isEsRole,
  isInstructorRole,
  isSuperAdminRole,
  normalizeRole,
} from "@wayfinder/supabase/roles";
import { loadPreEtsAssignedSchoolIds } from "@wayfinder/supabase/pre-ets-staff-assignments";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/my-compliance";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const url = new URL(request.url);
  const onlyLate = url.searchParams.get("onlyLate") !== "0";

  try {
    const admin = createServiceRoleClient();
    const role = normalizeRole(auth.role);
    const isFieldStaff = isInstructorRole(role) || isEsRole(role);
    const assignedSchoolIds = await loadPreEtsAssignedSchoolIds(admin, auth.userId, auth.role);

    const sessions = await loadPreEtsSessionCompliance(admin, {
      schoolIds:
        !isSuperAdminRole(role) && assignedSchoolIds?.length
          ? assignedSchoolIds
          : undefined,
      instructorUserId: isFieldStaff && !isSuperAdminRole(role) ? auth.userId : undefined,
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
