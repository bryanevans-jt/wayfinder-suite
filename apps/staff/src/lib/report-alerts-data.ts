import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import {
  clientInSupervisorScope,
  esUserAllowedForSupervisor,
  loadSupervisorScope,
} from "@/lib/supervisor-client-scope";

export type ReportAlertRow = {
  id: string;
  alertType: "missing" | "overdue";
  reportingMonth: string;
  clientId: string;
  clientName: string;
  esUserId: string;
  dueAt: string | null;
  createdAt: string;
};

type AlertRecord = {
  id: string;
  alert_type: string;
  reporting_month: string;
  wayfinder_client_id: string | null;
  client_name: string;
  es_user_id: string;
  due_at: string | null;
  created_at: string;
};

function mapAlert(row: AlertRecord): ReportAlertRow | null {
  if (!row.wayfinder_client_id) return null;
  return {
    id: row.id,
    alertType: row.alert_type as "missing" | "overdue",
    reportingMonth: row.reporting_month,
    clientId: row.wayfinder_client_id,
    clientName: row.client_name,
    esUserId: row.es_user_id,
    dueAt: row.due_at,
    createdAt: row.created_at,
  };
}

async function filterAlertsForSupervisor(
  admin: SupabaseClient,
  supervisorUserId: string,
  rows: AlertRecord[]
): Promise<ReportAlertRow[]> {
  const scope = await loadSupervisorScope(admin, supervisorUserId);
  const results: ReportAlertRow[] = [];

  for (const row of rows) {
    const mapped = mapAlert(row);
    if (!mapped) continue;

    if (esUserAllowedForSupervisor(scope, mapped.esUserId)) {
      results.push(mapped);
      continue;
    }

    if (await clientInSupervisorScope(admin, scope, mapped.clientId)) {
      results.push(mapped);
    }
  }

  return results;
}

export async function loadReportAlertsForStaffUser(
  admin: SupabaseClient,
  userId: string,
  role: string | null
): Promise<ReportAlertRow[]> {
  const { data, error } = await admin
    .from("report_dashboard_alerts")
    .select(
      "id, alert_type, reporting_month, wayfinder_client_id, client_name, es_user_id, due_at, created_at"
    )
    .eq("state", "GA")
    .eq("report_type_slug", "seMonthly")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AlertRecord[];

  if (isAdminTierRole(role)) {
    return rows.map(mapAlert).filter((r): r is ReportAlertRow => r !== null);
  }

  if (isEsRole(role)) {
    return rows
      .filter((row) => row.es_user_id === userId)
      .map(mapAlert)
      .filter((r): r is ReportAlertRow => r !== null);
  }

  if (isSupervisorRole(role)) {
    return filterAlertsForSupervisor(admin, userId, rows);
  }

  return [];
}
