import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySupervisorsForEs, notifyUser } from "@wayfinder/supabase/notify-user";
import { renderTemplatedFlatEmail } from "@wayfinder/supabase/render-templated-email";
import { getGoogleAuth, sendEmail } from "./google";
import {
  computeSeMonthlyNonCompliant,
  type ReportingPeriod,
  type SeMonthlyCandidate,
  REPORT_TYPE_SLUG,
} from "./se-monthly-compliance";

export type ComplianceCronResult = {
  alertType: "missing" | "overdue";
  reportingMonth: string;
  candidateCount: number;
  alertsCreated: number;
  alertsResolved: number;
  emailsSent: number;
  notificationsSent: number;
};

async function loadOpenAlertKeys(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  reportingMonth: string
): Promise<Set<string>> {
  const { data } = await admin
    .from("report_dashboard_alerts")
    .select("wayfinder_client_id")
    .eq("alert_type", alertType)
    .eq("report_type_slug", REPORT_TYPE_SLUG)
    .eq("reporting_month", reportingMonth)
    .is("resolved_at", null);

  return new Set((data ?? []).map((r) => r.wayfinder_client_id as string));
}

async function resolveCompliantAlerts(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  reportingMonth: string,
  nonCompliantClientIds: Set<string>
): Promise<number> {
  const { data: openAlerts } = await admin
    .from("report_dashboard_alerts")
    .select("id, wayfinder_client_id")
    .eq("alert_type", alertType)
    .eq("report_type_slug", REPORT_TYPE_SLUG)
    .eq("reporting_month", reportingMonth)
    .is("resolved_at", null);

  const idsToResolve = (openAlerts ?? [])
    .filter((row) => !nonCompliantClientIds.has(row.wayfinder_client_id as string))
    .map((row) => row.id as string);

  if (idsToResolve.length === 0) return 0;

  const now = new Date().toISOString();
  const { data } = await admin
    .from("report_dashboard_alerts")
    .update({ resolved_at: now })
    .in("id", idsToResolve)
    .select("id");

  return data?.length ?? 0;
}

async function upsertAlerts(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  period: ReportingPeriod,
  candidates: SeMonthlyCandidate[],
  existingKeys: Set<string>
): Promise<{ created: number; notificationsSent: number }> {
  let created = 0;
  let notificationsSent = 0;

  for (const candidate of candidates) {
    if (existingKeys.has(candidate.clientId)) continue;

    const { error } = await admin.from("report_dashboard_alerts").insert({
      alert_type: alertType,
      state: "GA",
      report_type_slug: REPORT_TYPE_SLUG,
      reporting_month: period.reportingMonth,
      wayfinder_client_id: candidate.clientId,
      client_name: candidate.clientName,
      es_user_id: candidate.esUserId,
      due_at: period.dueAt.toISOString(),
    });

    if (error) {
      if (error.code === "23505") continue;
      console.error("report_dashboard_alerts insert failed:", error.message);
      continue;
    }

    created++;
    existingKeys.add(candidate.clientId);

    const monthLabel = period.reportingMonth;
    const title =
      alertType === "missing"
        ? `Missing SE Monthly report — ${candidate.clientName}`
        : `Overdue SE Monthly report — ${candidate.clientName}`;
    const body = `${candidate.clientName} (${candidate.stageTitle}) — reporting month ${monthLabel}. GVRA deadline is the 10th at 5:00 PM ET.`;

    await notifyUser(admin, {
      userId: candidate.esUserId,
      kind: alertType === "missing" ? "report_missing" : "report_overdue",
      title,
      body,
      link_path: "/dashboard/reporting",
      metadata: {
        clientId: candidate.clientId,
        reportingMonth: period.reportingMonth,
        alertType,
      },
      app: "staff",
    });
    notificationsSent++;

    await notifySupervisorsForEs(admin, candidate.esUserId, {
      kind: alertType === "missing" ? "report_missing" : "report_overdue",
      title: `${title} (${candidate.esName})`,
      body,
      link_path: "/dashboard/reporting",
      metadata: {
        clientId: candidate.clientId,
        esUserId: candidate.esUserId,
        reportingMonth: period.reportingMonth,
        alertType,
      },
      app: "staff",
    });
    notificationsSent++;
  }

  return { created, notificationsSent };
}

function formatReportList(candidates: SeMonthlyCandidate[]): string {
  return candidates.map((c) => ` - ${c.esName} - ${c.clientName} - ${c.stageTitle}`).join("\n");
}

async function sendReportListEmail(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  candidates: SeMonthlyCandidate[],
  recipients: string[]
): Promise<number> {
  if (recipients.length === 0 || candidates.length === 0) return 0;

  const templateKey =
    alertType === "missing" ? "report_alerts_missing" : "report_alerts_overdue";
  const mail = await renderTemplatedFlatEmail(admin, templateKey, {
    report_list: formatReportList(candidates),
  });

  const auth = await getGoogleAuth();
  for (const to of recipients) {
    await sendEmail(auth, {
      to,
      subject: mail.subject,
      text: mail.text,
    });
  }

  return recipients.length;
}

async function resolveAuthEmails(
  admin: SupabaseClient,
  userIds: string[]
): Promise<Map<string, string>> {
  const emails = new Map<string, string>();
  await Promise.all(
    userIds.map(async (userId) => {
      const { data } = await admin.auth.admin.getUserById(userId);
      const email = data.user?.email?.trim().toLowerCase();
      if (email) emails.set(userId, email);
    })
  );
  return emails;
}

/** Supervisors get lists scoped to their assigned ESs; admins keep the full org-wide list. */
async function emailComplianceLists(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  candidates: SeMonthlyCandidate[]
): Promise<number> {
  if (candidates.length === 0) return 0;

  const { data: config } = await admin
    .from("admin_config")
    .select("report_notification_recipients")
    .maybeSingle();
  const adminRecipients = [
    ...new Set(
      ((config?.report_notification_recipients as string[] | undefined) ?? [])
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean)
    ),
  ];

  let emailsSent = await sendReportListEmail(admin, alertType, candidates, adminRecipients);

  const esUserIds = [...new Set(candidates.map((c) => c.esUserId))];
  const { data: links } = await admin
    .from("supervisor_es_assignments")
    .select("supervisor_user_id, es_user_id")
    .in("es_user_id", esUserIds);

  if (!links?.length) return emailsSent;

  const candidatesByEs = new Map<string, SeMonthlyCandidate[]>();
  for (const candidate of candidates) {
    const list = candidatesByEs.get(candidate.esUserId) ?? [];
    list.push(candidate);
    candidatesByEs.set(candidate.esUserId, list);
  }

  const candidatesBySupervisor = new Map<string, SeMonthlyCandidate[]>();
  for (const link of links) {
    const supervisorId = link.supervisor_user_id as string;
    const forEs = candidatesByEs.get(link.es_user_id as string);
    if (!forEs?.length) continue;
    const existing = candidatesBySupervisor.get(supervisorId) ?? [];
    const seen = new Set(existing.map((c) => c.clientId));
    for (const row of forEs) {
      if (!seen.has(row.clientId)) {
        existing.push(row);
        seen.add(row.clientId);
      }
    }
    candidatesBySupervisor.set(supervisorId, existing);
  }

  const supervisorEmails = await resolveAuthEmails(admin, [...candidatesBySupervisor.keys()]);
  const adminEmailSet = new Set(adminRecipients);

  for (const [supervisorId, scopedCandidates] of candidatesBySupervisor) {
    const email = supervisorEmails.get(supervisorId);
    if (!email || adminEmailSet.has(email)) continue;
    emailsSent += await sendReportListEmail(admin, alertType, scopedCandidates, [email]);
  }

  return emailsSent;
}

export async function runReportComplianceCron(
  admin: SupabaseClient,
  alertType: "missing" | "overdue"
): Promise<ComplianceCronResult> {
  const { candidates, period } = await computeSeMonthlyNonCompliant(admin, alertType);
  const nonCompliantIds = new Set(candidates.map((c) => c.clientId));

  const alertsResolved = await resolveCompliantAlerts(
    admin,
    alertType,
    period.reportingMonth,
    nonCompliantIds
  );

  const existingKeys = await loadOpenAlertKeys(admin, alertType, period.reportingMonth);
  const { created, notificationsSent } = await upsertAlerts(
    admin,
    alertType,
    period,
    candidates,
    existingKeys
  );

  const emailsSent = await emailComplianceLists(admin, alertType, candidates);

  return {
    alertType,
    reportingMonth: period.reportingMonth,
    candidateCount: candidates.length,
    alertsCreated: created,
    alertsResolved,
    emailsSent,
    notificationsSent,
  };
}
