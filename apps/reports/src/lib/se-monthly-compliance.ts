import type { SupabaseClient } from "@supabase/supabase-js";
import { clientDisplayName } from "@wayfinder/branding";
import {
  GVRA_DEADLINE_DAY,
  GVRA_DEADLINE_HOUR,
  GVRA_DEADLINE_MINUTE,
  SUPPORTED_EMPLOYMENT_STAGES,
} from "./constants";

export type SeMonthlyCandidate = {
  clientId: string;
  clientName: string;
  esUserId: string;
  esName: string;
  stageTitle: string;
};

export type ReportingPeriod = {
  reportingMonth: string;
  priorReportingMonth: string;
  dueAt: Date;
};

const REPORT_TYPE_SLUG = "seMonthly";

/** Convert a wall-clock time in America/New_York to UTC. */
function easternLocalToUtc(
  year: number,
  month1: number,
  day: number,
  hour: number,
  minute: number
): Date {
  const target = `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
  let utcGuess = Date.UTC(year, month1 - 1, day, hour + 5, minute);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(utcGuess)).map((p) => [p.type, p.value])
    );
    const observed = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
    if (observed === `${target}:00`) {
      return new Date(utcGuess);
    }
    const [ty, tm, td, th, tmin] = [
      Number(parts.year),
      Number(parts.month),
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    ];
    const observedUtc = Date.UTC(ty, tm - 1, td, th, tmin);
    const desiredUtc = Date.UTC(year, month1 - 1, day, hour, minute);
    utcGuess += desiredUtc - observedUtc;
  }

  return new Date(utcGuess);
}

export function gvraDueAtForReportingMonth(reportingMonth: string): Date {
  const [y, m] = reportingMonth.split("-").map(Number);
  let dueYear = y;
  let dueMonth = m + 1;
  if (dueMonth > 12) {
    dueMonth = 1;
    dueYear += 1;
  }
  return easternLocalToUtc(dueYear, dueMonth, GVRA_DEADLINE_DAY, GVRA_DEADLINE_HOUR, GVRA_DEADLINE_MINUTE);
}

export function getReportingPeriod(now = new Date()): ReportingPeriod {
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const prevYear = thisMonth === 0 ? thisYear - 1 : thisYear;
  const reportingMonth = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}`;

  const priorPrevMonth = prevMonth === 0 ? 11 : prevMonth - 1;
  const priorPrevYear = prevMonth === 0 ? prevYear - 1 : prevYear;
  const priorReportingMonth = `${priorPrevYear}-${String(priorPrevMonth + 1).padStart(2, "0")}`;

  return {
    reportingMonth,
    priorReportingMonth,
    dueAt: gvraDueAtForReportingMonth(reportingMonth),
  };
}

async function loadSubmittedClientIds(
  admin: SupabaseClient,
  reportingMonth: string
): Promise<Set<string>> {
  const submitted = new Set<string>();

  const { data: formal } = await admin
    .from("formal_report_submissions")
    .select("wayfinder_client_id")
    .eq("report_type_slug", REPORT_TYPE_SLUG)
    .eq("reporting_month", reportingMonth)
    .not("wayfinder_client_id", "is", null);

  for (const row of formal ?? []) {
    submitted.add(row.wayfinder_client_id as string);
  }

  const { data: legacy } = await admin
    .from("monthly_se_reports")
    .select("wayfinder_client_id")
    .eq("last_submitted_month", reportingMonth)
    .not("wayfinder_client_id", "is", null);

  for (const row of legacy ?? []) {
    submitted.add(row.wayfinder_client_id as string);
  }

  return submitted;
}

export async function loadSeMonthlyCandidates(admin: SupabaseClient): Promise<SeMonthlyCandidate[]> {
  const { data: gaOffices } = await admin.from("offices").select("id").eq("state", "GA");
  const officeIds = (gaOffices ?? []).map((o) => o.id as string);
  if (officeIds.length === 0) return [];

  const { data: milestones } = await admin
    .from("service_milestones")
    .select("id, title")
    .in("title", [...SUPPORTED_EMPLOYMENT_STAGES]);

  const stageIds = (milestones ?? []).map((m) => m.id as string);
  const stageById = new Map((milestones ?? []).map((m) => [m.id as string, m.title as string]));
  if (stageIds.length === 0) return [];

  const { data: clients } = await admin
    .from("clients")
    .select("id, user_id, profile_id, contact_email, current_stage_id")
    .in("office_id", officeIds)
    .in("current_stage_id", stageIds)
    .is("archived_at", null);

  if (!clients?.length) return [];

  const clientIds = clients.map((c) => c.id as string);
  const { data: assignments } = await admin
    .from("es_client_assignments")
    .select("client_id, es_user_id")
    .in("client_id", clientIds);

  const esByClient = new Map<string, string>();
  for (const link of assignments ?? []) {
    const clientId = link.client_id as string;
    if (!esByClient.has(clientId)) {
      esByClient.set(clientId, link.es_user_id as string);
    }
  }

  const profileIds = [
    ...new Set(
      clients
        .flatMap((c) => [c.user_id, c.profile_id])
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];
  const esUserIds = [...new Set(esByClient.values())];

  const [{ data: clientProfiles }, { data: esProfiles }] = await Promise.all([
    profileIds.length
      ? admin.from("profiles").select("id, full_name").in("id", profileIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    esUserIds.length
      ? admin.from("profiles").select("id, full_name").in("id", esUserIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const profileNameById = new Map((clientProfiles ?? []).map((p) => [p.id, p.full_name]));
  const esNameById = new Map((esProfiles ?? []).map((p) => [p.id, p.full_name ?? "Unknown ES"]));

  const results: SeMonthlyCandidate[] = [];
  for (const client of clients) {
    const clientId = client.id as string;
    const esUserId = esByClient.get(clientId);
    if (!esUserId) continue;

    const stageTitle = client.current_stage_id
      ? stageById.get(client.current_stage_id as string)
      : undefined;
    if (!stageTitle) continue;

    const authId = (client.user_id ?? client.profile_id) as string | null;
    results.push({
      clientId,
      clientName: clientDisplayName({
        full_name: authId ? (profileNameById.get(authId) ?? null) : null,
        contact_email: client.contact_email as string | null,
        id: clientId,
      }),
      esUserId,
      esName: esNameById.get(esUserId) ?? "Unknown ES",
      stageTitle,
    });
  }

  return results;
}

export async function computeSeMonthlyNonCompliant(
  admin: SupabaseClient,
  alertType: "missing" | "overdue",
  now = new Date()
): Promise<{ candidates: SeMonthlyCandidate[]; period: ReportingPeriod }> {
  const period = getReportingPeriod(now);
  const allCandidates = await loadSeMonthlyCandidates(admin);
  const submittedCurrent = await loadSubmittedClientIds(admin, period.reportingMonth);
  const submittedPrior = await loadSubmittedClientIds(admin, period.priorReportingMonth);

  const candidates = allCandidates.filter(
    (c) => !submittedCurrent.has(c.clientId) && submittedPrior.has(c.clientId)
  );

  if (alertType === "overdue" && now < period.dueAt) {
    return { candidates: [], period };
  }

  return { candidates, period };
}

export { REPORT_TYPE_SLUG };
