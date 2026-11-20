import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  formatBillableHours,
  sumBillableMinutesFromTimeEntryRows,
} from "@wayfinder/supabase/client-billable";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
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

  let scopedEsUserIds: string[] | null = null;
  if (isSupervisorRole(role) && !isAdminTierRole(role)) {
    const scope = await loadSupervisorScope(admin, session.effectiveUserId);
    if (scope.esUserIds.length === 0) {
      return NextResponse.json({ period, rows: [] });
    }
    scopedEsUserIds = scope.esUserIds;
  }

  type SummaryEntryRow = {
    es_user_id: string;
    duration_minutes: number;
    flags: Record<string, boolean> | null;
    service_activity_types:
      | { code: string; counts_toward_client_billable?: boolean }
      | { code: string; counts_toward_client_billable?: boolean }[]
      | null;
  };

  const entries = await fetchAllPostgrestRows<SummaryEntryRow>(
    admin,
    "es_time_entries",
    "es_user_id, duration_minutes, flags, service_activity_types ( code, counts_toward_client_billable )",
    {
      order: { column: "id", ascending: true },
      applyFilters: (query) => {
        let filtered = query
          .gte("service_date", period.start)
          .lte("service_date", period.end)
          .neq("status", "rejected");
        if (scopedEsUserIds) {
          filtered = filtered.in("es_user_id", scopedEsUserIds);
        }
        return filtered;
      },
    }
  );

  const byEs = new Map<string, number>();
  for (const e of entries) {
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
