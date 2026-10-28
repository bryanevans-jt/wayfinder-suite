import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  formatBillableHours,
  sumBillableMinutesFromTimeEntryRows,
} from "@wayfinder/supabase/client-billable";
import { resolvePayPeriod, type PayrollSettingsRow } from "@wayfinder/supabase/payroll-period";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { loadStaffNameById } from "@/lib/staff-names";
import { loadSupervisorScope } from "@/lib/supervisor-client-scope";
import { NextResponse } from "next/server";

function canView(role: string | null | undefined): boolean {
  return (
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isHrRole(role) ||
    role === "accountant"
  );
}

/** Billable hours by ES for the current pay period (compliance / payroll oversight). */
export async function GET(request: Request) {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (!session || !canView(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
      ? { start: fromParam, end: toParam }
      : resolvePayPeriod(settings);

  let query = admin
    .from("es_time_entries")
    .select(
      "es_user_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )"
    )
    .gte("service_date", period.start)
    .lte("service_date", period.end)
    .neq("status", "rejected");

  if (isSupervisorRole(role) && !isAdminTierRole(role)) {
    const scope = await loadSupervisorScope(admin, session.effectiveUserId);
    if (scope.esUserIds.length === 0) {
      return NextResponse.json({ period, rows: [] });
    }
    query = query.in("es_user_id", scope.esUserIds);
  }

  const { data: entries } = await query;
  const byEs = new Map<string, number>();
  for (const e of entries ?? []) {
    const id = e.es_user_id as string;
    const add = sumBillableMinutesFromTimeEntryRows([
      {
        duration_minutes: Number(e.duration_minutes) || 0,
        flags: (e.flags as Record<string, boolean>) ?? {},
        service_activity_types: e.service_activity_types as
          | { code: string; counts_toward_client_billable?: boolean }
          | { code: string; counts_toward_client_billable?: boolean }[]
          | null,
      },
    ]);
    byEs.set(id, (byEs.get(id) ?? 0) + add);
  }

  const names = await loadStaffNameById(admin, [...byEs.keys()], "ES");
  const rows = [...byEs.entries()]
    .map(([esUserId, minutes]) => ({
      esUserId,
      esName: names.get(esUserId) ?? "ES",
      billableMinutes: minutes,
      billableHours: formatBillableHours(minutes),
    }))
    .sort((a, b) => a.esName.localeCompare(b.esName));

  return NextResponse.json({ period, rows });
}
