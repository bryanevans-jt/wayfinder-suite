import { assertStaffExportSession } from "@/lib/export-access";
import { activityLogsToCsv, loadActivityLogs } from "@/lib/portal-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await assertStaffExportSession(["es"]);
  if (auth.error) {
    return auth.error;
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 }
    );
  }

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
      "Content-Disposition": 'attachment; filename="wayfinder-client-activity.csv"',
    },
  });
}
