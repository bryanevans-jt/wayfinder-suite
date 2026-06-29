import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { driveFileUrl } from "@/lib/formal-report-utils";
import { requireAppSession, requireStaffClientAccess } from "@/lib/app-session";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const REPORT_LABELS: Record<string, string> = {
  seMonthly: "SE Monthly Report",
  vpr: "Vocational Progress Report",
  jtsgvmr: "JTSG Vocational Monthly Report",
  evf: "Employment Verification Form",
  jtsgtsvs: "JTSG Time Sheet",
};

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/clients/[id]/formal-reports";
  const { id: clientId } = await context.params;
  const session = await requireAppSession();
  const allowed = await requireStaffClientAccess(session, clientId);
  if (!allowed) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const { data, error } = await admin
      .from("formal_report_submissions")
      .select(
        "id, report_type_slug, state, reporting_month, submitted_by_name, drive_file_id, drive_file_name, created_at"
      )
      .eq("wayfinder_client_id", clientId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return respondWithLoggedError("staff", route, error, actor);
    }

    return NextResponse.json({
      submissions: (data ?? []).map((row) => ({
        id: row.id,
        reportType: row.report_type_slug,
        reportLabel: REPORT_LABELS[row.report_type_slug as string] ?? row.report_type_slug,
        state: row.state,
        reportingMonth: row.reporting_month,
        submittedByName: row.submitted_by_name,
        driveFileName: row.drive_file_name,
        driveUrl: driveFileUrl(row.drive_file_id as string | null),
        createdAt: row.created_at,
      })),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
