import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  resolvePayPeriod,
  shiftPayPeriod,
  type PayrollSettingsRow,
} from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, isSuperAdminRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

async function loadPayrollSettings(): Promise<PayrollSettingsRow> {
  const admin = createServiceRoleClient();
  const { data } = await admin.from("org_payroll_settings").select("*").limit(1).maybeSingle();
  return {
    pay_period_frequency: (data?.pay_period_frequency as PayrollSettingsRow["pay_period_frequency"]) ?? "biweekly",
    period_start_date: (data?.period_start_date as string) ?? new Date().toISOString().slice(0, 10),
    period_end_date: (data?.period_end_date as string | null) ?? null,
  };
}

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const settings = await loadPayrollSettings();
    const url = new URL(request.url);
    const shift = url.searchParams.get("shift");
    let period = resolvePayPeriod(settings);
    if (shift === "-1" || shift === "1") {
      period = shiftPayPeriod(settings, Number(shift) as -1 | 1, period);
    }
    return NextResponse.json({ settings, period });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load payroll settings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as Partial<PayrollSettingsRow>;
  const admin = createServiceRoleClient();
  const { data: row } = await admin.from("org_payroll_settings").select("id").limit(1).maybeSingle();

  const patch = {
    pay_period_frequency: body.pay_period_frequency,
    period_start_date: body.period_start_date,
    period_end_date: body.period_end_date ?? null,
    updated_at: new Date().toISOString(),
    updated_by: session.effectiveUserId,
  };

  const { error } = row?.id
    ? await admin.from("org_payroll_settings").update(patch).eq("id", row.id)
    : await admin.from("org_payroll_settings").insert(patch);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
