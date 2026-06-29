import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertReportingUser } from "@/lib/wayfinder-caseload";
import { reportApiCatchError } from "@/lib/api-error";
import { NextResponse } from "next/server";

type ReportingState = "GA" | "TN";

const GA_REPORTS = [
  { slug: "seMonthly", name: "SE Monthly Reports", requiresClient: true, requiresSignature: true },
  { slug: "vpr", name: "Vocational Progress Reports", requiresClient: false, requiresSignature: false },
  { slug: "jtsgvmr", name: "JTSG Vocational Monthly Reports", requiresClient: true, requiresSignature: true },
  { slug: "jtsgtsvs", name: "JTSG Time Sheet for Vocational Services", requiresClient: false, requiresSignature: false },
  { slug: "evf", name: "Employment Verification Form", requiresClient: false, requiresSignature: false },
] as const;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const state = new URL(request.url).searchParams.get("state") as ReportingState | null;
    if (!state || (state !== "GA" && state !== "TN")) {
      return NextResponse.json({ error: "state must be GA or TN" }, { status: 400 });
    }

    const admin = createAdminClient();
    await assertReportingUser(admin, user.id);

    if (state === "GA") {
      return NextResponse.json({
        state,
        gaReports: GA_REPORTS,
        programs: [],
      });
    }

    const { data: programs } = await admin
      .from("report_service_programs")
      .select("id, name, slug, enabled, sort_order")
      .eq("state", "TN")
      .order("sort_order", { ascending: true });

    const programIds = (programs ?? []).map((p) => p.id as string);
    const { data: reportTypes } =
      programIds.length > 0
        ? await admin
            .from("report_type_definitions")
            .select(
              "id, program_id, slug, name, enabled, requires_signature, template_kind, sort_order, tag_schema"
            )
            .eq("state", "TN")
            .in("program_id", programIds)
            .order("sort_order", { ascending: true })
        : { data: [] };

    const typesByProgram = new Map<string, typeof reportTypes>();
    for (const row of reportTypes ?? []) {
      const pid = row.program_id as string;
      const list = typesByProgram.get(pid) ?? [];
      list.push(row);
      typesByProgram.set(pid, list);
    }

    return NextResponse.json({
      state,
      gaReports: [],
      programs: (programs ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        enabled: p.enabled,
        reports: (typesByProgram.get(p.id as string) ?? [])
          .filter((r) => r.enabled)
          .map((r) => ({
            id: r.id,
            slug: r.slug,
            name: r.name,
            requiresSignature: r.requires_signature,
            templateKind: r.template_kind,
            tagSchema: r.tag_schema ?? [],
          })),
      })),
    });
  } catch (e) {
    return reportApiCatchError("api/wayfinder/report-catalog", e);
  }
}
