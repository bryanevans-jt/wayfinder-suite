import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isEsReplyOverdue } from "@wayfinder/supabase/business-hours";
import { MIN_CONTACTS_PER_MONTH } from "@wayfinder/supabase/caseload-triage";
import { isAdminTierRole, STAFF_ROLES } from "@wayfinder/supabase/roles";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
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
  role: string;
  roleLabel: string;
  caseloadCount: number;
  /** Average billable minutes per week over the last 4 weeks (total ÷ 4). */
  billableMinutesAvgPerWeek4Weeks: number;
  /** Billable minutes in the last 7 days. */
  billableMinutesLast7Days: number;
};

const CAPACITY_ROLE_LABELS: Record<string, string> = {
  es: "Employment Specialist",
  supervisor: "Supervisor",
  accountant: "Accounts Specialist",
  admin: "Admin",
  counselor: "Counselor",
  super_admin: "Super Admin",
  hr: "HR",
  hospitality_specialist: "Hospitality Specialist",
  wrt_admin: "WRT Admin",
};

function capacityRoleLabel(role: string): string {
  return CAPACITY_ROLE_LABELS[role] ?? role;
}

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

  const [esName, nameById] = await Promise.all([
    loadStaffNameById(admin, esUserIds),
    loadClientDisplayNameById(admin, clientIds),
  ]);

  const reports: ComplianceReportRow[] = (alerts ?? []).map((a) => ({
    id: a.id as string,
    alertType: a.alert_type as string,
    clientName: nameById.get(a.wayfinder_client_id as string) ?? "Client",
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

    const thinNames = await loadClientDisplayNameById(admin, clientIds);
    const esName = esNameMap.get(esUserId) ?? "Employment Specialist";
    for (const c of clientRows ?? []) {
      const count = countByClient.get(c.id as string) ?? 0;
      if (count < MIN_CONTACTS_PER_MONTH) {
        thinLogs.push({
          clientId: c.id as string,
          clientLabel: thinNames.get(c.id as string) ?? (c.contact_email as string) ?? "Client",
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
  const includeAllStaffRoles = isAdminTierRole(role);

  type TargetStaff = { id: string; role: string };
  let targets: TargetStaff[] = [];

  if (includeAllStaffRoles) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, role, is_active")
      .in("role", [...STAFF_ROLES]);
    targets = (profiles ?? [])
      .filter((p) => p.is_active !== false)
      .map((p) => ({ id: p.id as string, role: p.role as string }));
  } else {
    const esIds = await scopedEsUserIds(admin, role, userId);
    const ids =
      esIds ??
      (
        await admin.from("profiles").select("id").eq("role", "es").neq("is_active", false)
      ).data?.map((r) => r.id as string) ??
      [];
    targets = ids.map((id) => ({ id, role: "es" }));
  }

  if (!targets.length) return [];

  const now = new Date();
  const fourWeeksAgo = new Date(now);
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const since4Weeks = fourWeeksAgo.toISOString().slice(0, 10);
  const since7Days = sevenDaysAgo.toISOString().slice(0, 10);

  const targetIds = targets.map((t) => t.id);
  const esNameById = await loadStaffNameById(admin, targetIds);

  const rows: EsCapacityRow[] = [];
  for (const person of targets) {
    const { count } = await admin
      .from("es_client_assignments")
      .select("client_id", { count: "exact", head: true })
      .eq("es_user_id", person.id);

    const { data: entries } = await admin
      .from("es_time_entries")
      .select("duration_minutes, service_date")
      .eq("es_user_id", person.id)
      .gte("service_date", since4Weeks)
      .in("status", ["draft", "submitted", "approved"]);

    let minutesLast4Weeks = 0;
    let minutesLast7Days = 0;
    for (const e of entries ?? []) {
      const mins = e.duration_minutes as number;
      minutesLast4Weeks += mins;
      if ((e.service_date as string) >= since7Days) {
        minutesLast7Days += mins;
      }
    }

    rows.push({
      esUserId: person.id,
      esName: esNameById.get(person.id) ?? capacityRoleLabel(person.role),
      role: person.role,
      roleLabel: capacityRoleLabel(person.role),
      caseloadCount: count ?? 0,
      billableMinutesAvgPerWeek4Weeks: Math.round(minutesLast4Weeks / 4),
      billableMinutesLast7Days: minutesLast7Days,
    });
  }

  return rows.sort((a, b) => {
    if (b.caseloadCount !== a.caseloadCount) return b.caseloadCount - a.caseloadCount;
    const roleCmp = a.roleLabel.localeCompare(b.roleLabel, undefined, { sensitivity: "base" });
    if (roleCmp !== 0) return roleCmp;
    return a.esName.localeCompare(b.esName, undefined, { sensitivity: "base" });
  });
}

export type SupervisorWeekPack = {
  messageSla: number;
  thinContacts: number;
  reportGaps: number;
  timesheetsPending: number;
};

/** Compact counts for supervisor portal home (“This week”). */
export async function loadSupervisorWeekPack(
  userId: string,
  role: string
): Promise<SupervisorWeekPack> {
  const coachingRole = role === "supervisor" ? "supervisor" : role;
  const [coaching, compliance] = await Promise.all([
    coachingRole === "supervisor"
      ? loadCoachingQueue(userId)
      : Promise.resolve({ sla: [] as CoachingSlaRow[], thinLogs: [] as CoachingThinLogRow[] }),
    loadComplianceCalendar(role, userId),
  ]);

  return {
    messageSla: coaching.sla.length,
    thinContacts: coaching.thinLogs.length,
    reportGaps: compliance.reports.length,
    timesheetsPending: compliance.timesheets.length,
  };
}
