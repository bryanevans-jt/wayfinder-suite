import { assertStaffExportSession } from "@/lib/export-access";
import {
  formatContactLogsDailyVprText,
  loadContactLogsForEasternDay,
} from "@/lib/contact-log-daily-copy";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/exports/contact-logs-daily";
  const auth = await assertStaffExportSession(["es"]);
  if (auth.error) {
    return auth.error;
  }

  const url = new URL(request.url);
  const clientId = url.searchParams.get("client")?.trim();
  const date = url.searchParams.get("date")?.trim();

  if (!clientId) {
    return NextResponse.json({ error: "client is required" }, { status: 400 });
  }
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const actor = { userId: auth.user.id, userRole: auth.role };

  try {
    const assigned = await esIsAssignedToClient(auth.user.id, clientId);
    if (!assigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createServiceRoleClient();
    const rows = await loadContactLogsForEasternDay(admin, clientId, date);
    const text = formatContactLogsDailyVprText(rows);

    return NextResponse.json({ text, count: rows.length });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
