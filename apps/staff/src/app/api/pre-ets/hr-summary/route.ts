import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSessionCompliance } from "@wayfinder/supabase/pre-ets-compliance";
import {
  canViewPreEtsHr,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET() {
  const route = "api/pre-ets/hr-summary";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const role = session.effectiveRole;

    if (!canViewPreEtsHr(role, settings)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lateSessions = await loadPreEtsSessionCompliance(admin, { onlyLate: true });

    const { data: packets } = await admin
      .from("pre_ets_invoice_packets")
      .select("status")
      .limit(500);

    const packetCounts = {
      draft: 0,
      ready: 0,
      submitted: 0,
      paid: 0,
    };
    for (const p of packets ?? []) {
      const status = p.status as keyof typeof packetCounts;
      if (status in packetCounts) packetCounts[status]++;
    }

    const { count: activeSchools } = await admin
      .from("pre_ets_schools")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);

    return NextResponse.json({
      summary: {
        overdueSessions: lateSessions.length,
        missingRoster: lateSessions.filter((s) => s.missingRoster).length,
        missingCar: lateSessions.filter((s) => s.missingCar).length,
        activeSchools: activeSchools ?? 0,
        invoicePackets: packetCounts,
        submissionDeadlineHours: settings.submission_deadline_hours,
        ytdWarningThreshold: settings.ytd_unit_warning_threshold,
        schoolYear: settings.school_year,
      },
      overdueSessions: lateSessions.slice(0, 25),
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
