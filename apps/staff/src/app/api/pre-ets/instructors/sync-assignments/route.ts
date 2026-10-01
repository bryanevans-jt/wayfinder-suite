import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { syncPreEtsSchoolAssignmentsFromSpreadsheet } from "@wayfinder/supabase/pre-ets-instructor-sync";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/instructors/sync-assignments";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as {
    serviceMonth?: string;
    districtId?: string;
  };

  try {
    const admin = createServiceRoleClient();
    const result = await syncPreEtsSchoolAssignmentsFromSpreadsheet(admin, {
      serviceMonth: body.serviceMonth ?? "",
      districtId: body.districtId,
    });
    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
