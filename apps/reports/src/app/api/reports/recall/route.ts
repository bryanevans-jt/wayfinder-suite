import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { reportApiLoggedError, resolveReportErrorActor } from "@/lib/api-error";
import { NextResponse } from "next/server";

const RECALL_SKIP = new Set([
  "jobdevelopment",
  "month",
  "daterangecovers",
  "datereportsubmitted",
  "hoursofcoaching",
]);

function toCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export async function GET(request: Request) {
  const route = "api/reports/recall";
  try {
    const { searchParams } = new URL(request.url);
    const adHoc = searchParams.get("adHoc") === "true";
    const wayfinderClientId = searchParams.get("wayfinderClientId")?.trim();
    const clientId = searchParams.get("clientId")?.trim();

    if (adHoc) {
      return NextResponse.json({});
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const actor = await resolveReportErrorActor();
    const admin = createAdminClient();
    let row: Record<string, unknown> | null = null;

    if (wayfinderClientId) {
      const { data, error } = await admin
        .from("monthly_se_reports")
        .select("*")
        .eq("wayfinder_client_id", wayfinderClientId)
        .maybeSingle();
      if (error) return reportApiLoggedError(route, error, actor);
      row = data as Record<string, unknown> | null;
    }

    if (!row && clientId) {
      const { data, error } = await admin
        .from("monthly_se_reports")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) return reportApiLoggedError(route, error, actor);
      row = data as Record<string, unknown> | null;
    }

    if (!row) {
      return NextResponse.json({});
    }

    const recall: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      if (
        key === "id" ||
        key === "client_id" ||
        key === "wayfinder_client_id" ||
        key === "last_submitted" ||
        key === "last_submitted_month" ||
        key === "created_at" ||
        key === "updated_at"
      ) {
        continue;
      }
      const camel = toCamel(key);
      if (RECALL_SKIP.has(camel.toLowerCase())) {
        continue;
      }
      recall[camel] = value;
    }

    return NextResponse.json(recall);
  } catch (e) {
    return reportApiLoggedError(route, e);
  }
}
