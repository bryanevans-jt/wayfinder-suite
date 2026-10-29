import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { saveKraBillableMonthSnapshot } from "@wayfinder/supabase/kra-billable-compliance";
import { canManageKraBillableSettings } from "@wayfinder/supabase/kra-billable-settings";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";
import { canViewPayrollMonthlyBillableHours } from "@/lib/billable-hours-payroll-access";
import { loadOrgKraBillableComplianceRollup } from "@/lib/kra-billable-compliance-data";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const route = "api/admin/kra-billable-compliance";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canViewPayrollMonthlyBillableHours(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthKey = url.searchParams.get("month")?.trim();
  if (!monthKey) {
    return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
  }

  try {
    const payload = await loadOrgKraBillableComplianceRollup(monthKey);
    return NextResponse.json(payload);
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}

export async function POST(request: Request) {
  const route = "api/admin/kra-billable-compliance";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canManageKraBillableSettings(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { action?: string; month?: string };
    if (body.action !== "close") {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }
    const monthKey = body.month?.trim();
    if (!monthKey) {
      return NextResponse.json({ error: "month is required (YYYY-MM)" }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const live = await loadOrgKraBillableComplianceRollup(monthKey);
    if (live.frozen) {
      return NextResponse.json({ ok: true, alreadyClosed: true, payload: live });
    }
    await saveKraBillableMonthSnapshot(admin, monthKey, live, session.effectiveUserId);
    const payload = await loadOrgKraBillableComplianceRollup(monthKey);
    return NextResponse.json({ ok: true, payload });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: session.effectiveUserId,
      userRole: role,
    });
  }
}
