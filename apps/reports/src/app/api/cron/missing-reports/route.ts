import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCronLoggedError } from "@/lib/api-error";
import { runReportComplianceCron } from "@/lib/sync-report-alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorizeCron(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");
  const cronSecret = process.env.CRON_SECRET;
  return !cronSecret || authHeader === `Bearer ${cronSecret}` || secretParam === cronSecret;
}

export async function GET(request: Request) {
  const route = "api/cron/missing-reports";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await runReportComplianceCron(admin, "missing");
    return NextResponse.json(result);
  } catch (err) {
    return reportCronLoggedError(route, err);
  }
}
