import type { SupabaseClient } from "@supabase/supabase-js";
import { notifySupervisorsForEs, notifyUser } from "@wayfinder/supabase/notify-user";
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

async function emailRecipients(
  alertType: "missing" | "overdue",
  candidates: SeMonthlyCandidate[],
  recipients: string[]
): Promise<number> {
  if (recipients.length === 0 || candidates.length === 0) return 0;

  const lines = candidates.map(
    (c) => ` - ${c.esName} - ${c.clientName} - ${c.stageTitle}`
  );
  const intro =
    alertType === "missing"
      ? "The following GVRA Monthly Reports are not yet submitted (deadline: 10th at 5:00 PM ET):\n\n"
      : "The following GVRA Monthly Reports are OVERDUE (deadline was 10th at 5:00 PM ET):\n\n";

  const auth = await getGoogleAuth();
  for (const to of recipients) {
    await sendEmail(auth, {
      to,
      subject: alertType === "missing" ? "Missing Reports List" : "Overdue GVRA Monthly Reports",
      text: intro + lines.join("\n"),
    });
  }

  return recipients.length;
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

  const { data: config } = await admin
    .from("admin_config")
    .select("report_notification_recipients")
    .maybeSingle();
  const recipients = (config?.report_notification_recipients as string[] | undefined) ?? [];
  const emailsSent = await emailRecipients(alertType, candidates, recipients);

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
