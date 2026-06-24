import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { resolvePayPeriod, type PayrollSettingsRow } from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || (!isSupervisorRole(role) && !isAdminTierRole(role) && role !== "accountant")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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

    const { data: weeks } = await admin
      .from("es_time_week_submissions")
      .select("id, es_user_id, week_start, week_end, total_minutes, approved_at")
      .eq("status", "approved")
      .gte("week_start", period.start)
      .lte("week_end", period.end);

    const esIds = [...new Set((weeks ?? []).map((w) => w.es_user_id as string))];
    const { data: profiles } = esIds.length
      ? await admin.from("profiles").select("id, full_name, email").in("id", esIds)
      : { data: [] };
    const esName = new Map(
      (profiles ?? []).map((p) => [
        p.id as string,
        (p.full_name as string | null)?.trim() || (p.email as string) || "ES",
      ])
    );

    const { data: entries } = await admin
      .from("es_time_entries")
      .select(
        "es_user_id, client_id, service_date, duration_minutes, activity_type_id, service_activity_types(code, name)"
      )
      .eq("status", "approved")
      .gte("service_date", period.start)
      .lte("service_date", period.end);

    const header =
      "es_name,es_user_id,service_date,duration_minutes,activity_code,activity_name,client_id\n";
    const lines = (entries ?? []).map((e) => {
      const types = e.service_activity_types as { code: string; name: string } | { code: string; name: string }[] | null;
      const type = Array.isArray(types) ? types[0] : types;
      const name = esName.get(e.es_user_id as string) ?? "ES";
      return [
        `"${name.replace(/"/g, '""')}"`,
        e.es_user_id,
        e.service_date,
        e.duration_minutes,
        type?.code ?? "",
        `"${(type?.name ?? "").replace(/"/g, '""')}"`,
        e.client_id ?? "",
      ].join(",");
    });

    const csv = header + lines.join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wayfinder-payroll-${period.start}-${period.end}.csv"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Payroll export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
