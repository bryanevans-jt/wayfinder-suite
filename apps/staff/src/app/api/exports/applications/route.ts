import { assertStaffExportSession } from "@/lib/export-access";
import { applicationsToCsv, loadApplicationsExportRows } from "@/lib/es-exports";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/exports/applications";
  const auth = await assertStaffExportSession(["es", "supervisor"]);
  if (auth.error) {
    return auth.error;
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client") ?? undefined;

  try {
    const rows = await loadApplicationsExportRows(auth.supabase, { clientId });
    const csv = applicationsToCsv(rows);

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="wayfinder-applications-by-client.csv"',
      },
    });
  } catch (error) {
    return respondWithLoggedError("staff", route, error, {
      userId: auth.user.id,
      userRole: auth.role,
    });
  }
}
