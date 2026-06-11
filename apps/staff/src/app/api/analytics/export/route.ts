import {
  assertAnalyticsSession,
  esUserIdAllowed,
  officeIdAllowed,
} from "@/lib/analytics/access";
import {
  analyticsExportToCsv,
  loadAnalyticsExportRows,
} from "@/lib/analytics/load-metrics";
import {
  respondWithLoggedError,
  USER_FACING_FORBIDDEN,
} from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/analytics/export";
  const auth = await assertAnalyticsSession();
  if ("error" in auth) {
    return auth.error;
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const officeId = url.searchParams.get("officeId");
  const esUserId = url.searchParams.get("esUserId");

  if (!officeIdAllowed(auth.scope, officeId)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }
  if (!esUserIdAllowed(auth.scope, esUserId)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  try {
    const rows = await loadAnalyticsExportRows(auth.admin, auth.scope, {
      from,
      to,
      officeId,
      esUserId,
    });
    const csv = analyticsExportToCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wayfinder-analytics-client-facts.csv"',
      },
    });
  } catch (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: auth.actorUserId,
      userRole: auth.role,
    });
  }
}
