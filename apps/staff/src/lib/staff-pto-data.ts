import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  countBusinessDaysInclusive,
  resolvePtoPeriodWindow,
  todayEasternDateString,
  type OrgPtoSettingsRow,
  type StaffPtoRequestRow,
} from "@wayfinder/supabase/staff-pto-shared";

type Admin = ReturnType<typeof createServiceRoleClient>;

export async function loadOrgPtoSettings(admin: Admin): Promise<OrgPtoSettingsRow> {
  const { data, error } = await admin.from("org_pto_settings").select("*").limit(1).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (data) {
    return {
      id: data.id as string,
      period_start_date: data.period_start_date as string,
      annual_pto_days:
        data.annual_pto_days == null ? null : Number(data.annual_pto_days),
      updated_at: data.updated_at as string,
      updated_by: (data.updated_by as string | null) ?? null,
    };
  }

  const periodStart = `${new Date().getFullYear()}-01-01`;
  const { data: inserted, error: insertErr } = await admin
    .from("org_pto_settings")
    .insert({ period_start_date: periodStart, annual_pto_days: null })
    .select("*")
    .single();
  if (insertErr) {
    throw new Error(insertErr.message);
  }
  return {
    id: inserted.id as string,
    period_start_date: inserted.period_start_date as string,
    annual_pto_days: null,
    updated_at: inserted.updated_at as string,
    updated_by: (inserted.updated_by as string | null) ?? null,
  };
}

export function mapPtoRequestRow(row: Record<string, unknown>): StaffPtoRequestRow {
  return {
    id: row.id as string,
    requester_user_id: row.requester_user_id as string,
    start_date: row.start_date as string,
    end_date: row.end_date as string,
    reason: row.reason as StaffPtoRequestRow["reason"],
    details: (row.details as string | null) ?? null,
    days_charged: Number(row.days_charged),
    days_charged_manual: Boolean(row.days_charged_manual),
    status: row.status as StaffPtoRequestRow["status"],
    decision_notes: (row.decision_notes as string | null) ?? null,
    decided_by: (row.decided_by as string | null) ?? null,
    decided_at: (row.decided_at as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export async function loadApprovedDaysUsedInPeriod(
  admin: Admin,
  userId: string,
  periodStart: string,
  periodEndExclusive: string
): Promise<number> {
  const { data, error } = await admin
    .from("staff_pto_requests")
    .select("days_charged, start_date, end_date")
    .eq("requester_user_id", userId)
    .eq("status", "approved")
    .lt("start_date", periodEndExclusive)
    .gte("end_date", periodStart);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).reduce((sum, row) => sum + Number(row.days_charged), 0);
}

export async function loadPtoBalanceForUser(admin: Admin, userId: string) {
  const settings = await loadOrgPtoSettings(admin);
  const today = todayEasternDateString();
  const period = resolvePtoPeriodWindow(settings.period_start_date, today);
  const unlimited = settings.annual_pto_days == null;
  const used = await loadApprovedDaysUsedInPeriod(
    admin,
    userId,
    period.start,
    period.endExclusive
  );
  const pending = await loadPendingDaysInPeriod(admin, userId, period.start, period.endExclusive);

  return {
    settings,
    period,
    unlimited,
    annualDays: settings.annual_pto_days,
    usedDays: used,
    pendingDays: pending,
    remainingDays: unlimited ? null : Number(settings.annual_pto_days) - used,
  };
}

async function loadPendingDaysInPeriod(
  admin: Admin,
  userId: string,
  periodStart: string,
  periodEndExclusive: string
): Promise<number> {
  const { data, error } = await admin
    .from("staff_pto_requests")
    .select("days_charged")
    .eq("requester_user_id", userId)
    .eq("status", "pending")
    .lt("start_date", periodEndExclusive)
    .gte("end_date", periodStart);

  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.days_charged), 0);
}

export async function findOverlappingRequests(
  admin: Admin,
  userId: string,
  startDate: string,
  endDate: string,
  excludeId?: string
): Promise<StaffPtoRequestRow[]> {
  let query = admin
    .from("staff_pto_requests")
    .select("*")
    .eq("requester_user_id", userId)
    .in("status", ["pending", "approved"])
    .lte("start_date", endDate)
    .gte("end_date", startDate);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => mapPtoRequestRow(row as Record<string, unknown>));
}

export async function logPtoEdit(
  admin: Admin,
  input: {
    requestId: string;
    editedBy: string;
    action: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    note?: string | null;
  }
) {
  const { error } = await admin.from("staff_pto_request_edits").insert({
    request_id: input.requestId,
    edited_by: input.editedBy,
    action: input.action,
    before_state: input.before,
    after_state: input.after,
    note: input.note ?? null,
  });
  if (error) {
    throw new Error(error.message);
  }
}

export { countBusinessDaysInclusive };
