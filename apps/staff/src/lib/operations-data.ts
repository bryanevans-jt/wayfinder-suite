import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isEsReplyOverdue } from "@wayfinder/supabase/business-hours";
import { MIN_CONTACTS_PER_MONTH } from "@wayfinder/supabase/caseload-triage";
import { loadStaffNameById } from "@/lib/staff-names";

export { loadStaffNameById } from "@/lib/staff-names";

type Admin = ReturnType<typeof createServiceRoleClient>;

export type ComplianceReportRow = {
  id: string;
  alertType: string;
  clientName: string;
  esName: string;
  reportingMonth: string;
  dueAt: string | null;
};

export type ComplianceTimesheetRow = {
  id: string;
  esUserId: string;
  esName: string;
  weekStart: string;
  status: string;
  totalMinutes: number;
};

export type CoachingSlaRow = {
  threadId: string;
  clientLabel: string;
  esName: string;
  lastClientMessageAt: string;
};

export type CoachingThinLogRow = {
  clientId: string;
  clientLabel: string;
  esName: string;
  contactsThisMonth: number;
};

export type EsCapacityRow = {
  esUserId: string;
  esName: string;
  caseloadCount: number;
  billableMinutesLast4Weeks: number;
};

async function scopedEsUserIds(
  admin: Admin,
  role: string,
  userId: string
): Promise<string[] | null> {
  if (role === "super_admin" || role === "admin") return null;
  if (role === "supervisor") {
    const { loadSupervisorScope } = await import("@/lib/supervisor-client-scope");
    const scope = await loadSupervisorScope(admin, userId);
    return [...new Set(scope.esUserIds)];
  }
  return [userId];
}

export async function loadComplianceCalendar(
  role: string,
  userId: string
): Promise<{ reports: ComplianceReportRow[]; timesheets: ComplianceTimesheetRow[] }> {
  const admin = createServiceRoleClient();
  const esIds = await scopedEsUserIds(admin, role, userId);

  let reportQuery = admin
    .from("report_dashboard_alerts")
    .select("id, alert_type, reporting_month, due_at, es_user_id, wayfinder_client_id")
    .is("resolved_at", null)
    .order("due_at", { ascending: true });

  if (esIds) {
    reportQuery = reportQuery.in("es_user_id", esIds.length ? esIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: alerts } = await reportQuery;

  const clientIds = [...new Set((alerts ?? []).map((a) => a.wayfinder_client_id as string).filter(Boolean))];
  const esUserIds = [...new Set((alerts ?? []).map((a) => a.es_user_id as string))];

  const [{ data: clients }, esName] = await Promise.all([
    clientIds.length
      ? admin.from("clients").select("id, contact_email, user_id, profile_id").in("id", clientIds)
      : { data: [] },
    loadStaffNameById(admin, esUserIds),
  ]);

  const clientName = new Map<string, string>();
  for (const c of clients ?? []) {
    clientName.set(c.id as string, (c.contact_email as string) ?? "Client");
  }

  const reports: ComplianceReportRow[] = (alerts ?? []).map((a) => ({
    id: a.id as string,
    alertType: a.alert_type as string,
    clientName: clientName.get(a.wayfinder_client_id as string) ?? "Client",
    esName: esName.get(a.es_user_id as string) ?? "Employment Specialist",
    reportingMonth: a.reporting_month as string,
    dueAt: (a.due_at as string | null) ?? null,
  }));

  let weekQuery = admin
    .from("es_time_week_submissions")
    .select("id, es_user_id, week_start, status, total_minutes")
    .in("status", ["submitted", "returned"])
    .order("week_start", { ascending: false })
    .limit(100);

  if (esIds) {
    weekQuery = weekQuery.in("es_user_id", esIds.length ? esIds : ["00000000-0000-0000-0000-000000000000"]);
  }

  const { data: weeks } = await weekQuery;
  const weekEsIds = [...new Set((weeks ?? []).map((w) => w.es_user_id as string))];
  const weekEsName = await loadStaffNameById(admin, weekEsIds);

  const timesheets: ComplianceTimesheetRow[] = (weeks ?? []).map((w) => ({
    id: w.id as string,
    esUserId: w.es_user_id as string,
    esName: weekEsName.get(w.es_user_id as string) ?? "Employment Specialist",
    weekStart: w.week_start as string,
    status: w.status as string,
    totalMinutes: w.total_minutes as number,
  }));

  return { reports, timesheets };
}

export async function loadCoachingQueue(
  supervisorUserId: string
): Promise<{ sla: CoachingSlaRow[]; thinLogs: CoachingThinLogRow[] }> {
  const admin = createServiceRoleClient();
  const esIds = await scopedEsUserIds(admin, "supervisor", supervisorUserId);
  if (!esIds?.length) return { sla: [], thinLogs: [] };

  const { data: threads } = await admin
    .from("client_message_threads")
    .select("id, client_id, client_label, current_es_user_id, last_client_message_at, last_es_message_at")
    .in("current_es_user_id", esIds);

  const overdueEsIds = [...new Set((threads ?? []).map((t) => t.current_es_user_id as string))];
  const esNameMap = await loadStaffNameById(admin, [...new Set([...overdueEsIds, ...esIds])]);

  const sla: CoachingSlaRow[] = [];
  for (const t of threads ?? []) {
    const lastClient = t.last_client_message_at as string | null;
    const lastEs = t.last_es_message_at as string | null;
    if (!lastClient || !isEsReplyOverdue(lastClient, lastEs)) continue;
    sla.push({
      threadId: t.id as string,
      clientLabel: (t.client_label as string | null) ?? "Client",
      esName: esNameMap.get(t.current_es_user_id as string) ?? "Employment Specialist",
      lastClientMessageAt: lastClient,
    });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthIso = monthStart.toISOString();

  const thinLogs: CoachingThinLogRow[] = [];
  for (const esUserId of esIds) {
    const { data: links } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", esUserId);
    const clientIds = (links ?? []).map((l) => l.client_id as string);
    if (!clientIds.length) continue;

    const { data: logs } = await admin
      .from("contact_logs")
      .select("client_id")
      .in("client_id", clientIds)
      .gte("created_at", monthIso);

    const countByClient = new Map<string, number>();
    for (const row of logs ?? []) {
      const cid = row.client_id as string;
      countByClient.set(cid, (countByClient.get(cid) ?? 0) + 1);
    }

    const { data: clientRows } = await admin
      .from("clients")
      .select("id, contact_email")
      .in("id", clientIds)
      .is("archived_at", null);

    const esName = esNameMap.get(esUserId) ?? "Employment Specialist";
    for (const c of clientRows ?? []) {
      const count = countByClient.get(c.id as string) ?? 0;
      if (count < MIN_CONTACTS_PER_MONTH) {
        thinLogs.push({
          clientId: c.id as string,
          clientLabel: (c.contact_email as string) ?? "Client",
          esName,
          contactsThisMonth: count,
        });
      }
    }
  }

  return { sla, thinLogs };
}

export async function loadEsCapacityRows(
  role: string,
  userId: string
): Promise<EsCapacityRow[]> {
  const admin = createServiceRoleClient();
  const esIds = await scopedEsUserIds(admin, role, userId);
  const targetEs =
    esIds ??
    (
      await admin
        .from("profiles")
        .select("id")
        .eq("role", "es")
    ).data?.map((r) => r.id as string) ??
    [];

  if (!targetEs.length) return [];

  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const since = fourWeeksAgo.toISOString().slice(0, 10);

  const esNameById = await loadStaffNameById(admin, targetEs);

  const rows: EsCapacityRow[] = [];
  for (const esUserId of targetEs) {
    const { count } = await admin
      .from("es_client_assignments")
      .select("client_id", { count: "exact", head: true })
      .eq("es_user_id", esUserId);

    const { data: entries } = await admin
      .from("es_time_entries")
      .select("duration_minutes")
      .eq("es_user_id", esUserId)
      .gte("service_date", since)
      .in("status", ["draft", "submitted", "approved"]);

    rows.push({
      esUserId,
      esName: esNameById.get(esUserId) ?? "Employment Specialist",
      caseloadCount: count ?? 0,
      billableMinutesLast4Weeks: (entries ?? []).reduce(
        (sum, e) => sum + (e.duration_minutes as number),
        0
      ),
    });
  }

  return rows.sort((a, b) => b.caseloadCount - a.caseloadCount);
}
