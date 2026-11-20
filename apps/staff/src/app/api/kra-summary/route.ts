import { resolveAuthUserIdByEmail } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadKraBillableComplianceRollup } from "@wayfinder/supabase/kra-billable-compliance";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isStaffRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";
import {
  KRA_SUMMARY_SECRET_ENV,
  KRA_SUMMARY_SECRET_HEADER,
  buildKraSummaryPayload,
  careersKraSecretsEqual,
  emptyStaffComplianceRow,
  kraSummaryRateLimited,
  normalizeKraSummaryEmail,
  parseQuarterKey,
  staffRowToMonthSummary,
  type KraMonthSummary,
} from "@/lib/kra-summary";

export const dynamic = "force-dynamic";

/**
 * Machine-to-machine KRA billable-hours summary for Joshua Tree Careers quarterly reviews.
 * Auth: X-Careers-Kra-Secret === WAYFINDER_KRA_SHARED_SECRET (no session cookies).
 * Returns aggregate counts only — never client names or ids.
 */
export async function GET(request: Request) {
  const route = "api/kra-summary";

  const expected = process.env[KRA_SUMMARY_SECRET_ENV]?.trim() ?? "";
  if (!expected) {
    return NextResponse.json(
      { error: `${KRA_SUMMARY_SECRET_ENV} not configured` },
      { status: 503 }
    );
  }

  const provided = request.headers.get(KRA_SUMMARY_SECRET_HEADER)?.trim() ?? "";
  if (!provided || !careersKraSecretsEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const email = normalizeKraSummaryEmail(url.searchParams.get("email"));
  const quarterParsed = parseQuarterKey(url.searchParams.get("quarter"));

  if (!email || !quarterParsed) {
    return NextResponse.json(
      { error: "Query requires email and quarter=YYYY-Qn" },
      { status: 400 }
    );
  }

  const rateKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    email;
  if (kraSummaryRateLimited(rateKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const admin = createServiceRoleClient();
    const userId = await resolveAuthUserIdByEmail(admin, email);
    if (!userId) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    const { data: profile } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.is_active === false || !isStaffRole(profile.role as string)) {
      return NextResponse.json({ error: "Staff profile not found" }, { status: 404 });
    }

    const staffUserId = profile.id as string;
    // Empty name maps: rollup may still resolve names server-side, but we strip
    // the clients array and never return client identifiers to Careers.
    const nameByStaffId = new Map<string, string>([[staffUserId, "Team member"]]);
    const nameByClientId = new Map<string, string>();

    const months: KraMonthSummary[] = [];
    for (const monthKey of quarterParsed.monthKeys) {
      const rollup = await loadKraBillableComplianceRollup(
        admin,
        monthKey,
        nameByStaffId,
        nameByClientId
      );
      const row =
        rollup.rows.find((r) => r.staffUserId === staffUserId) ??
        emptyStaffComplianceRow(staffUserId);
      months.push(
        staffRowToMonthSummary(rollup.monthKey, rollup.monthLabel, rollup.frozen, row)
      );
    }

    return NextResponse.json(
      buildKraSummaryPayload(email, quarterParsed.quarter, months)
    );
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {});
  }
}
