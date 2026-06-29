import { createClient } from "@/lib/supabase/server";
import { reportApiCatchError } from "@/lib/api-error";
import {
  assertReportingUser,
  getCaseloadClientById,
  searchCaseloadClients,
  type ReportingState,
} from "@/lib/wayfinder-caseload";
import { createAdminClient } from "@/lib/supabase/admin";
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
    const state = searchParams.get("state") as ReportingState | null;
    const query = searchParams.get("q") ?? "";
    const clientId = searchParams.get("clientId");

    if (!state || (state !== "GA" && state !== "TN")) {
      return NextResponse.json({ error: "state must be GA or TN" }, { status: 400 });
    }

    const admin = createAdminClient();
    await assertReportingUser(admin, user.id);

    if (clientId) {
      const client = await getCaseloadClientById(admin, user.id, clientId);
      if (!client) {
        return NextResponse.json({ error: "Client not found in your caseload" }, { status: 404 });
      }
      return NextResponse.json({ clients: [client] });
    }

    const clients = await searchCaseloadClients(admin, user.id, { state, query, limit: 30 });
    return NextResponse.json({ clients });
  } catch (e) {
    return reportApiCatchError("api/wayfinder/clients", e);
  }
}
