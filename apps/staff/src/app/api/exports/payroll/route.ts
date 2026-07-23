import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import { resolvePayPeriod, type PayrollSettingsRow } from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { shiftDurationMinutes } from "@wayfinder/supabase/staff-time-clock-shared";
import { NextResponse } from "next/server";

function canExportPayroll(role: string | null | undefined): boolean {
  return (
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isHrRole(role) ||
    role === "accountant"
  );
}

/** Payroll export: hours worked from staff Time Clock shifts (not billable activity). */
export async function GET(request: Request) {
  const route = "api/exports/payroll";
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canExportPayroll(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const actor = { userId: session.effectiveUserId, userRole: role };

  try {
    const admin = createServiceRoleClient();
    const { data: settingsRow } = await admin
      .from("org_payroll_settings")
      .select("*")
      .limit(1)
      .maybeSingle();

    const settings: PayrollSettingsRow = {
      pay_period_frequency:
        (settingsRow?.pay_period_frequency as PayrollSettingsRow["pay_period_frequency"]) ??
        "biweekly",
      period_start_date:
        (settingsRow?.period_start_date as string) ?? new Date().toISOString().slice(0, 10),
      period_end_date: (settingsRow?.period_end_date as string | null) ?? null,
    };

    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    const period =
      fromParam && toParam
        ? { start: fromParam, end: toParam, frequency: settings.pay_period_frequency }
        : resolvePayPeriod(settings);

    const { data: shifts, error: shiftsErr } = await admin
      .from("staff_time_clock_shifts")
      .select("staff_user_id, local_date, clock_in_at, clock_out_at")
      .gte("local_date", period.start)
      .lte("local_date", period.end)
      .not("clock_out_at", "is", null);

    if (shiftsErr) {
      throw shiftsErr;
    }

    const byStaff = new Map<string, { minutes: number; count: number }>();
    for (const s of shifts ?? []) {
      const id = s.staff_user_id as string;
      const mins = shiftDurationMinutes(
        s.clock_in_at as string,
        s.clock_out_at as string | null
      );
      const cur = byStaff.get(id) ?? { minutes: 0, count: 0 };
      cur.minutes += mins;
      cur.count += 1;
      byStaff.set(id, cur);
    }

    const staffIds = [...byStaff.keys()];
    const { data: profiles } = staffIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", staffIds)
      : { data: [] };
    const staffName = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        (p.full_name as string | null)?.trim() || (p.email as string) || "Staff",
      ])
    );

    const header =
      "staff_name,staff_user_id,period_start,period_end,hours_worked_minutes,hours_worked,shift_count,note\n";
    const lines = [...byStaff.entries()]
      .map(([staffId, agg]) => {
        const name = staffName.get(staffId) ?? "Staff";
        return [
          `"${name.replace(/"/g, '""')}"`,
          staffId,
          period.start,
          period.end,
          String(agg.minutes),
          minutesToDecimalHours(agg.minutes),
          String(agg.count),
          '"From staff Time Clock (America/New_York); billable client hours are a separate export"',
        ].join(",");
      })
      .sort((a, b) => a.localeCompare(b));

    const csv = header + lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wayfinder-payroll-hours-worked-${period.start}-${period.end}.csv"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, actor);
  }
}
