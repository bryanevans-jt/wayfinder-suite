import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSessionCompliance } from "@wayfinder/supabase/pre-ets-compliance";
import {
  canViewPreEtsHr,
  loadPreEtsSettings,
} from "@wayfinder/supabase/pre-ets-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/pre-ets/hr-summary";
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = { userId: session.effectiveUserId, userRole: session.effectiveRole };
  const url = new URL(request.url);
  const schoolId = url.searchParams.get("schoolId") ?? undefined;

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    const role = session.effectiveRole;

    if (!canViewPreEtsHr(role, settings)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const lateSessions = await loadPreEtsSessionCompliance(admin, {
      schoolId,
      onlyLate: true,
    });

    let packetQuery = admin.from("pre_ets_invoice_packets").select("status").limit(500);
    if (schoolId) {
      const { data: auths } = await admin
        .from("pre_ets_authorizations")
        .select("id")
        .eq("school_id", schoolId);
      const authIds = (auths ?? []).map((a) => a.id as string);
      if (!authIds.length) {
        packetQuery = packetQuery.eq("authorization_id", "00000000-0000-0000-0000-000000000000");
      } else {
        packetQuery = packetQuery.in("authorization_id", authIds);
      }
    }

    const { data: packets } = await packetQuery;

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

    let activeSchools = 0;
    if (schoolId) {
      activeSchools = 1;
    } else {
      const { count } = await admin
        .from("pre_ets_schools")
        .select("id", { count: "exact", head: true });
      activeSchools = count ?? 0;
    }

    return NextResponse.json({
      summary: {
        overdueSessions: lateSessions.length,
        missingRoster: lateSessions.filter((s) => s.missingRoster).length,
        missingCar: lateSessions.filter((s) => s.missingCar).length,
        activeSchools,
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
