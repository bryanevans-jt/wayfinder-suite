import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  minutesToDecimalHours,
  workedMinutesFromEntries,
} from "@wayfinder/supabase/es-time-tracking";
import { resolvePayPeriod, type PayrollSettingsRow } from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

function canExportPayroll(role: string | null | undefined): boolean {
  return (
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isHrRole(role) ||
    role === "accountant"
  );
}

/** Payroll export: hours worked per ES (overlapping clock time counted once). */
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

    const { data: entries } = await admin
      .from("es_time_entries")
      .select(
        "es_user_id, service_date, duration_minutes, service_start_at, service_end_at, status"
      )
      .eq("status", "approved")
      .gte("service_date", period.start)
      .lte("service_date", period.end);

    const byEs = new Map<
      string,
      Array<{
        duration_minutes: number;
        service_start_at: string | null;
        service_end_at: string | null;
      }>
    >();
    for (const e of entries ?? []) {
      const esId = e.es_user_id as string;
      const list = byEs.get(esId) ?? [];
      list.push({
        duration_minutes: e.duration_minutes as number,
        service_start_at: (e.service_start_at as string | null) ?? null,
        service_end_at: (e.service_end_at as string | null) ?? null,
      });
      byEs.set(esId, list);
    }

    const esIds = [...byEs.keys()];
    const { data: profiles } = esIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", esIds)
      : { data: [] };
    const esName = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        (p.full_name as string | null)?.trim() || (p.email as string) || "ES",
      ])
    );

    const header =
      "es_name,es_user_id,period_start,period_end,hours_worked_minutes,hours_worked,entry_count,note\n";
    const lines = [...byEs.entries()]
      .map(([esId, esEntries]) => {
        const worked = workedMinutesFromEntries(esEntries);
        const name = esName.get(esId) ?? "ES";
        return [
          `"${name.replace(/"/g, '""')}"`,
          esId,
          period.start,
          period.end,
          String(worked),
          minutesToDecimalHours(worked),
          String(esEntries.length),
          '"Overlapping clock times counted once for payroll"',
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
