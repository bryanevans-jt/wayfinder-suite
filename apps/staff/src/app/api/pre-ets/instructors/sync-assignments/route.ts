import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { syncPreEtsInstructorsFromProgramGroups } from "@wayfinder/supabase/pre-ets-instructor-sync";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const route = "api/pre-ets/instructors/sync-assignments";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  const body = (await request.json().catch(() => ({}))) as { serviceMonth?: string };

  try {
    const admin = createServiceRoleClient();
    const result = await syncPreEtsInstructorsFromProgramGroups(admin, {
      serviceMonth: body.serviceMonth,
    });
    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
