import {
  assertAnalyticsSession,
  esUserIdAllowed,
  officeIdAllowed,
} from "@/lib/analytics/access";
import { loadAnalyticsFilterOptions } from "@/lib/analytics/load-metrics";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/analytics/filters";
  const auth = await assertAnalyticsSession();
  if ("error" in auth) {
    return auth.error;
  }

  try {
    const options = await loadAnalyticsFilterOptions(auth.admin, auth.scope);
    return NextResponse.json({
      ...options,
      role: auth.role,
      readOnly: auth.readOnly,
    });
  } catch (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: auth.actorUserId,
      userRole: auth.role,
    });
  }
}
