import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportCronLoggedError, reportApiLoggedError } from "@/lib/api-error";
import { authorizeReportsCron, unauthorizedCronResponse } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const route = "api/cron/vpr-cleanup";
  if (!authorizeReportsCron(request)) {
    return unauthorizedCronResponse();
  }

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 60);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("vpr_submissions")
      .delete()
      .lt("date", cutoffStr)
      .select("id");

    if (error) {
      return reportApiLoggedError(route, error);
    }

    return NextResponse.json({ deleted: data?.length ?? 0 });
  } catch (err) {
    return reportCronLoggedError(route, err);
  }
}
