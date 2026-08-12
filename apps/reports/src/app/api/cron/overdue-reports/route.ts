import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCronLoggedError } from "@/lib/api-error";
import { authorizeReportsCron, unauthorizedCronResponse } from "@/lib/cron-auth";
import { runReportComplianceCron } from "@/lib/sync-report-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const route = "api/cron/overdue-reports";
  if (!authorizeReportsCron(request)) {
    return unauthorizedCronResponse();
  }

  try {
    const admin = createAdminClient();
    const result = await runReportComplianceCron(admin, "overdue");
    return NextResponse.json(result);
  } catch (err) {
    return reportCronLoggedError(route, err);
  }
}
