import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  type CaseloadTriageFlag,
  NO_CONTACT_DAYS,
  STALE_APPLICATION_DAYS,
} from "@wayfinder/supabase/caseload-triage";
import { isTerminalApplicationStatus } from "@wayfinder/branding";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now.getTime() - t) / MS_PER_DAY);
}

export async function loadCaseloadTriageFlags(
  admin: AdminClient,
  esUserId: string,
  clientIds: string[]
): Promise<Map<string, CaseloadTriageFlag[]>> {
  const result = new Map<string, CaseloadTriageFlag[]>();
  if (clientIds.length === 0) return result;

  const now = new Date();

  const [logsRes, appsRes, meetingsRes, alertsRes] = await Promise.all([
    admin
      .from("contact_logs")
      .select("client_id, created_at")
      .in("client_id", clientIds)
      .order("created_at", { ascending: false }),
    admin
      .from("applications")
      .select("client_id, status, updated_at, created_at")
      .in("client_id", clientIds),
    admin
      .from("client_meeting_requests")
      .select("client_id, status, created_at")
      .in("client_id", clientIds)
      .eq("es_user_id", esUserId),
    admin
      .from("report_dashboard_alerts")
      .select("wayfinder_client_id")
      .eq("es_user_id", esUserId)
      .is("resolved_at", null)
      .in("wayfinder_client_id", clientIds),
  ]);

  const lastContact = new Map<string, string>();
  for (const row of logsRes.data ?? []) {
    const cid = row.client_id as string;
    if (!lastContact.has(cid)) {
      lastContact.set(cid, row.created_at as string);
    }
  }

  const staleAppClients = new Set<string>();
  for (const row of appsRes.data ?? []) {
    const status = row.status as string | null;
    if (isTerminalApplicationStatus(status)) continue;
    const updated = (row.updated_at ?? row.created_at) as string;
    const days = daysSince(updated, now);
    if (days != null && days >= STALE_APPLICATION_DAYS) {
      staleAppClients.add(row.client_id as string);
    }
  }

  const meetingPending = new Set<string>();
  for (const row of meetingsRes.data ?? []) {
    if ((row.status as string) === "pending_client") {
      meetingPending.add(row.client_id as string);
    }
  }

  const reportDue = new Set<string>();
  for (const row of alertsRes.data ?? []) {
    if (row.wayfinder_client_id) {
      reportDue.add(row.wayfinder_client_id as string);
    }
  }

  for (const clientId of clientIds) {
    const flags: CaseloadTriageFlag[] = [];
    const last = lastContact.get(clientId);
    const noContactDays = daysSince(last ?? null, now);
    if (noContactDays == null || noContactDays >= NO_CONTACT_DAYS) {
      flags.push("no_contact");
    }
    if (staleAppClients.has(clientId)) flags.push("stale_application");
    if (meetingPending.has(clientId)) flags.push("meeting_pending");
    if (reportDue.has(clientId)) flags.push("se_monthly_due");
    if (flags.length > 0) result.set(clientId, flags);
  }

  return result;
}

export type EmployerLastTouch = {
  employerId: string;
  touchedAt: string;
  touchedByUserId: string | null;
  touchedByName: string | null;
  outcome: string | null;
};

export async function loadEmployerLastTouches(
  admin: AdminClient,
  employerIds: string[]
): Promise<Map<string, EmployerLastTouch>> {
  const result = new Map<string, EmployerLastTouch>();
  if (employerIds.length === 0) return result;

  const [appsRes, timeRes] = await Promise.all([
    admin
      .from("applications")
      .select("employer_id, updated_at, created_at, status, client_id")
      .in("employer_id", employerIds)
      .not("employer_id", "is", null)
      .order("updated_at", { ascending: false }),
    admin
      .from("es_time_entries")
      .select("linked_source_id, service_date, es_user_id, narrative, updated_at")
      .eq("linked_source_type", "employer")
      .in("linked_source_id", employerIds),
  ]);

  type Candidate = EmployerLastTouch;
  const best = new Map<string, Candidate>();

  for (const row of appsRes.data ?? []) {
    const employerId = row.employer_id as string;
    const touchedAt = (row.updated_at ?? row.created_at) as string;
    const existing = best.get(employerId);
    if (!existing || new Date(touchedAt) > new Date(existing.touchedAt)) {
      best.set(employerId, {
        employerId,
        touchedAt,
        touchedByUserId: null,
        touchedByName: null,
        outcome: `Application: ${row.status as string}`,
      });
    }
  }

  for (const row of timeRes.data ?? []) {
    const employerId = row.linked_source_id as string;
    const touchedAt = (row.updated_at ?? `${row.service_date}T12:00:00.000Z`) as string;
    const existing = best.get(employerId);
    if (!existing || new Date(touchedAt) > new Date(existing.touchedAt)) {
      best.set(employerId, {
        employerId,
        touchedAt,
        touchedByUserId: row.es_user_id as string,
        touchedByName: null,
        outcome: (row.narrative as string | null)?.slice(0, 80) ?? "Employer contact",
      });
    }
  }

  const userIds = [
    ...new Set(
      [...best.values()]
        .map((v) => v.touchedByUserId)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", userIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  for (const [id, touch] of best) {
    if (touch.touchedByUserId) {
      touch.touchedByName = names.get(touch.touchedByUserId) ?? null;
    }
    result.set(id, touch);
  }

  return result;
}
