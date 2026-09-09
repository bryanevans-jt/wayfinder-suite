import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { applyPreEtsClassSetupAssignments } from "@wayfinder/supabase/pre-ets-class-setup";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

export async function POST() {
  const route = "api/pre-ets/setup/apply-assignments";
  const auth = await requirePreEtsApi("setup");
  if (isPreEtsApiError(auth)) return auth;

  try {
    const admin = createServiceRoleClient();
    const result = await applyPreEtsClassSetupAssignments(admin, auth.settings.school_year);
    return NextResponse.json(result);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
