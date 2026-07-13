import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isAdminTierRole, isHrRole } from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/hr/activity-export";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const role = session.effectiveRole ?? "";
  if (!isHrRole(role) && !isAdminTierRole(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const admin = createServiceRoleClient();
    const rows = await loadActivityLogs(
      admin,
      {
        officeId: url.searchParams.get("office") ?? undefined,
        esUserId: url.searchParams.get("es") ?? undefined,
        clientId: url.searchParams.get("client") ?? undefined,
        dateFrom: url.searchParams.get("from") ?? undefined,
        dateTo: url.searchParams.get("to") ?? undefined,
        limit: 5000,
      },
      undefined
    );

    const csv = activityLogsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="hr-activity-logs.csv"',
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}
