import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings } from "./pre-ets-settings";

export type PreEtsSessionDocStatus = {
  sessionId: string;
  sessionDate: string | null;
  status: string;
  schoolName: string | null;
  authNumber: string | null;
  hasSignedRoster: boolean;
  hasSubmittedCar: boolean;
  isCancelled: boolean;
  isLate: boolean;
  missingRoster: boolean;
  missingCar: boolean;
  hoursPastDue: number | null;
};

type SessionRow = {
  id: string;
  session_date: string | null;
  status: string;
  signed_roster_drive_file_id: string | null;
  signed_roster_uploaded_at: string | null;
  pre_ets_schools: { name: string } | { name: string }[] | null;
  pre_ets_authorizations: { auth_number: string | null } | { auth_number: string | null }[] | null;
  pre_ets_activity_reports:
    | { status: string; submitted_at: string | null }
    | { status: string; submitted_at: string | null }[]
    | null;
};

function schoolNameFromRow(row: SessionRow): string | null {
  const raw = row.pre_ets_schools;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.name ?? null;
  return raw.name ?? null;
}

function authNumberFromRow(row: SessionRow): string | null {
  const raw = row.pre_ets_authorizations;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0]?.auth_number ?? null;
  return raw.auth_number ?? null;
}

function activityReportFromRow(
  row: SessionRow
): { status: string; submitted_at: string | null } | null {
  const raw = row.pre_ets_activity_reports;
  if (!raw) return null;
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw;
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60);
}

function sessionDueAnchor(session: SessionRow): string | null {
  if (!session.session_date) return null;
  return `${session.session_date}T23:59:59.000Z`;
}

export function evaluateSessionDocumentation(
  session: SessionRow,
  deadlineHours: number
): Omit<PreEtsSessionDocStatus, "sessionId" | "sessionDate" | "status" | "schoolName" | "authNumber"> {
  const isCancelled = session.status === "cancelled" || session.status === "rescheduled";
  const hasSignedRoster = Boolean(session.signed_roster_drive_file_id);
  const car = activityReportFromRow(session);
  const hasSubmittedCar =
    car?.status === "submitted" || car?.status === "late_submitted";

  if (isCancelled) {
    return {
      hasSignedRoster,
      hasSubmittedCar,
      isCancelled: true,
      isLate: false,
      missingRoster: false,
      missingCar: false,
      hoursPastDue: null,
    };
  }

  const anchor = sessionDueAnchor(session);
  const elapsed = anchor ? hoursSince(anchor) : null;
  const isPastDeadline = elapsed !== null && elapsed > deadlineHours;

  const missingRoster = !hasSignedRoster;
  const missingCar = !hasSubmittedCar;
  const isLate = isPastDeadline && (missingRoster || missingCar);

  return {
    hasSignedRoster,
    hasSubmittedCar,
    isCancelled: false,
    isLate,
    missingRoster,
    missingCar,
    hoursPastDue: isLate ? Math.max(0, (elapsed ?? 0) - deadlineHours) : null,
  };
}

export async function loadPreEtsSessionCompliance(
  admin: SupabaseClient,
  filters?: { schoolId?: string; onlyLate?: boolean }
): Promise<PreEtsSessionDocStatus[]> {
  const settings = await loadPreEtsSettings(admin);
  const deadlineHours = settings.submission_deadline_hours;

  let query = admin
    .from("pre_ets_sessions")
    .select(
      "id, session_date, status, signed_roster_drive_file_id, signed_roster_uploaded_at, school_id, pre_ets_schools(name), pre_ets_authorizations(auth_number), pre_ets_activity_reports(status, submitted_at)"
    )
    .in("status", ["scheduled", "completed"])
    .not("session_date", "is", null)
    .order("session_date", { ascending: false })
    .limit(300);

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;
  if (error) {
    console.error("pre_ets session compliance load failed:", error.message);
    return [];
  }

  const rows = data ?? [];
  const results: PreEtsSessionDocStatus[] = [];

  for (const row of rows) {
    const evalResult = evaluateSessionDocumentation(row as SessionRow, deadlineHours);
    if (filters?.onlyLate && !evalResult.isLate) continue;

    const typed = row as SessionRow;
    results.push({
      sessionId: typed.id,
      sessionDate: typed.session_date,
      status: typed.status,
      schoolName: schoolNameFromRow(typed),
      authNumber: authNumberFromRow(typed),
      ...evalResult,
    });
  }

  return results;
}

export async function loadSupervisorNotifyUserIds(admin: SupabaseClient): Promise<string[]> {
  const { data } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["super_admin", "supervisor", "admin"]);
  return (data ?? []).map((r) => r.id as string);
}
