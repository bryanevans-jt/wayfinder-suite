import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildJobDevelopmentFromContactLogs } from "@/lib/job-development-prefill";
import { assertReportingUser, getCaseloadClientById } from "@/lib/wayfinder-caseload";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get("clientId")?.trim();
    const month = searchParams.get("month")?.trim() ?? new Date().toISOString().slice(0, 7);

    if (!clientId) {
      return NextResponse.json({ error: "clientId required" }, { status: 400 });
    }

    const admin = createAdminClient();
    await assertReportingUser(admin, user.id);
    const client = await getCaseloadClientById(admin, user.id, clientId);
    if (!client) {
      return NextResponse.json({ error: "Client not found in your caseload" }, { status: 404 });
    }

    const jobDevelopment = await buildJobDevelopmentFromContactLogs(admin, clientId, month);

    return NextResponse.json({
      clientId: client.id,
      clientName: client.name,
      counselorName: client.counselorName ?? "",
      employmentGoal: client.employmentGoal ?? "",
      officeState: client.officeState,
      jobDevelopment,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}
