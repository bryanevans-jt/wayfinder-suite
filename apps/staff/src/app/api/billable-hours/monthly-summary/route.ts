import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  currentMonthKey,
  loadOrgMonthlyBillableHoursRollup,
} from "@/lib/es-time-data";
import { loadOrgKraBillableComplianceRollup } from "@/lib/kra-billable-compliance-data";
import { canViewPayrollMonthlyBillableHours } from "@/lib/billable-hours-payroll-access";
import { NextResponse } from "next/server";

/** Calendar-month billable hours by staff (payroll). Defaults to current month (Eastern). */
export async function GET(request: Request) {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canViewPayrollMonthlyBillableHours(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month")?.trim();
  const monthKey = monthParam || currentMonthKey();

  try {
    const admin = createServiceRoleClient();
    const kra = await loadOrgKraBillableComplianceRollup(monthKey);
    const expectedMinutesByStaffId = new Map(
      kra.rows.map((r) => [r.staffUserId, r.expectedBillableMinutes] as const)
    );
    const payload = await loadOrgMonthlyBillableHoursRollup(admin, monthKey, {
      expectedMinutesByStaffId,
    });
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
