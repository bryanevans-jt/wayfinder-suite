import { assertStaffExportSession } from "@/lib/export-access";
import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/exports/activity";
  const auth = await assertStaffExportSession(["es"]);
  if (auth.error) {
    return auth.error;
  }

  const actor = { userId: auth.user.id, userRole: auth.role };

  try {
    const admin = createServiceRoleClient();
    const url = new URL(request.url);
    const rows = await loadActivityLogs(
      admin,
      {
        esUserId: auth.user.id,
        clientId: url.searchParams.get("client") ?? undefined,
        limit: Number(url.searchParams.get("limit") ?? "2000"),
      },
      undefined
    );

    const csv = activityLogsToCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wayfinder-activity.csv"',
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
