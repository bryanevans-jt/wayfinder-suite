import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
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
  reportTypeSlug: string;
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
  report_type_slug: string;
};

const OPEN_ALERTS_SELECT =
  "id, alert_type, reporting_month, wayfinder_client_id, client_name, es_user_id, due_at, created_at, report_type_slug";

async function loadOpenGaReportAlertRecords(
  admin: SupabaseClient,
  opts: { allReportTypes: boolean; limit: number }
): Promise<AlertRecord[]> {
  let query = admin
    .from("report_dashboard_alerts")
    .select(OPEN_ALERTS_SELECT)
    .eq("state", "GA")
    .is("resolved_at", null)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(opts.limit);

  if (!opts.allReportTypes) {
    query = query.eq("report_type_slug", "seMonthly");
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AlertRecord[];

  const { data: demoClients } = await admin.from("clients").select("id").eq("is_demo", true);
  const demoIds = new Set((demoClients ?? []).map((c) => c.id as string));
  return rows.filter((row) => !row.wayfinder_client_id || !demoIds.has(row.wayfinder_client_id));
}

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
    reportTypeSlug: row.report_type_slug,
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
  const productionRows = await loadOpenGaReportAlertRecords(admin, {
    allReportTypes: false,
    limit: 100,
  });

  if (isAdminTierRole(role)) {
    return productionRows.map(mapAlert).filter((r): r is ReportAlertRow => r !== null);
  }

  if (isFieldSpecialistRole(role)) {
    return productionRows
      .filter((row) => row.es_user_id === userId)
      .map(mapAlert)
      .filter((r): r is ReportAlertRow => r !== null);
  }

  if (isSupervisorRole(role)) {
    return filterAlertsForSupervisor(admin, userId, productionRows);
  }

  return [];
}

/** Compliance Calendar — org-wide open alerts for admin tier; scoped for supervisors. */
export async function loadComplianceReportAlerts(
  admin: SupabaseClient,
  userId: string,
  role: string | null
): Promise<ReportAlertRow[]> {
  const orgWide = isAdminTierRole(role);
  const productionRows = await loadOpenGaReportAlertRecords(admin, {
    allReportTypes: orgWide,
    limit: orgWide ? 500 : 100,
  });

  if (orgWide) {
    return productionRows.map(mapAlert).filter((r): r is ReportAlertRow => r !== null);
  }

  if (isSupervisorRole(role)) {
    return filterAlertsForSupervisor(admin, userId, productionRows);
  }

  return [];
}
