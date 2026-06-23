import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  const admin = createAdminClient();
  let row: Record<string, unknown> | null = null;

  if (wayfinderClientId) {
    const { data } = await admin
      .from("monthly_se_reports")
      .select("*")
      .eq("wayfinder_client_id", wayfinderClientId)
      .maybeSingle();
    row = data as Record<string, unknown> | null;
  }

  if (!row && clientId) {
    const { data } = await admin
      .from("monthly_se_reports")
      .select("*")
      .eq("client_id", clientId)
      .maybeSingle();
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
}
