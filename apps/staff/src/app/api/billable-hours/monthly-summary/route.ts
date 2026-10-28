import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  defaultPayrollMonthKey,
  loadOrgMonthlyBillableHoursRollup,
} from "@/lib/es-time-data";
import { canViewPayrollMonthlyBillableHours } from "@/lib/billable-hours-payroll-access";
import { NextResponse } from "next/server";

/** Calendar-month billable hours by staff (payroll). Defaults to prior month (Eastern). */
export async function GET(request: Request) {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canViewPayrollMonthlyBillableHours(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthParam = url.searchParams.get("month")?.trim();
  const monthKey = monthParam || defaultPayrollMonthKey();

  try {
    const admin = createServiceRoleClient();
    const payload = await loadOrgMonthlyBillableHoursRollup(admin, monthKey);
    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
