"use server";

import {
  weekEndSaturday,
  weekStartSunday,
} from "@wayfinder/supabase/es-time-tracking";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { revalidatePath } from "next/cache";

function requireAdmin() {
  return createServiceRoleClient();
}

async function assertTimeAccess() {
  const session = await getAppSession();
  if (!session) {
    throw new Error("Sign in required");
  }
  const role = session.effectiveRole;
  if (
    !isEsRole(role) &&
    !isSupervisorRole(role) &&
    role !== "accountant" &&
    !isAdminTierRole(role)
  ) {
    throw new Error("Not authorized");
  }
  return session;
}

export async function submitEsWeek(weekStartInput?: string) {
  await assertNotPreviewMutation();
  const session = await assertTimeAccess();
  if (!isEsRole(session.effectiveRole)) {
    throw new Error("Only employment specialists can submit weeks");
  }

  const admin = requireAdmin();
  const weekStart = weekStartInput ? weekStartSunday(weekStartInput) : weekStartSunday(new Date());
  const weekEnd = weekEndSaturday(weekStart);
  const esUserId = session.effectiveUserId;
  const now = new Date().toISOString();

  const { data: existingWeek } = await admin
    .from("es_time_week_submissions")
    .select("status")
    .eq("es_user_id", esUserId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existingWeek?.status === "submitted" || existingWeek?.status === "approved") {
    throw new Error("This week is already submitted or approved");
  }

  const { data: draftEntries, error: loadErr } = await admin
    .from("es_time_entries")
    .select("id, duration_minutes")
    .eq("es_user_id", esUserId)
    .gte("service_date", weekStart)
    .lte("service_date", weekEnd)
    .in("status", ["draft", "rejected"]);

  if (loadErr) {
    throw new Error(loadErr.message);
  }

  if (!draftEntries?.length) {
    throw new Error("No draft time entries for this week");
  }

  const totalMinutes = draftEntries.reduce(
    (sum, row) => sum + (row.duration_minutes as number),
    0
  );

  const { data: weekRow, error: weekErr } = await admin
    .from("es_time_week_submissions")
    .upsert(
      {
        es_user_id: esUserId,
        week_start: weekStart,
        week_end: weekEnd,
        total_minutes: totalMinutes,
        status: "submitted",
        submitted_at: now,
      },
      { onConflict: "es_user_id,week_start" }
    )
    .select("id")
    .maybeSingle();

  if (weekErr || !weekRow?.id) {
    throw new Error(weekErr?.message ?? "Could not create week submission");
  }

  const entryIds = draftEntries.map((r) => r.id as string);
  const { error: updErr } = await admin
    .from("es_time_entries")
    .update({
      status: "submitted",
      week_submission_id: weekRow.id,
      submitted_at: now,
      updated_at: now,
    })
    .in("id", entryIds);

  if (updErr) {
    throw new Error(updErr.message);
  }

  revalidatePath("/dashboard/timesheet");
}

export async function approveEsWeek(weekSubmissionId: string, notes?: string) {
  await assertNotPreviewMutation();
  const session = await assertTimeAccess();
  if (
    !isSupervisorRole(session.effectiveRole) &&
    !isAdminTierRole(session.effectiveRole)
  ) {
    throw new Error("Only supervisors can approve weeks");
  }

  const admin = requireAdmin();
  const now = new Date().toISOString();

  const { data: week, error: weekLoadErr } = await admin
    .from("es_time_week_submissions")
    .select("id, es_user_id, status")
    .eq("id", weekSubmissionId)
    .maybeSingle();

  if (weekLoadErr || !week) {
    throw new Error("Week submission not found");
  }

  if (isSupervisorRole(session.effectiveRole) && !isAdminTierRole(session.effectiveRole)) {
    const { data: link } = await admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", session.effectiveUserId)
      .eq("es_user_id", week.es_user_id as string)
      .maybeSingle();
    if (!link) {
      throw new Error("This ES is not on your team");
    }
  }

  const { error: weekErr } = await admin
    .from("es_time_week_submissions")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: session.effectiveUserId,
      supervisor_notes: notes?.trim() || null,
    })
    .eq("id", weekSubmissionId);

  if (weekErr) {
    throw new Error(weekErr.message);
  }

  const { error: entryErr } = await admin
    .from("es_time_entries")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: session.effectiveUserId,
      updated_at: now,
    })
    .eq("week_submission_id", weekSubmissionId);

  if (entryErr) {
    throw new Error(entryErr.message);
  }

  revalidatePath("/dashboard/timesheet");
}

export async function returnEsWeek(weekSubmissionId: string, notes: string) {
  await assertNotPreviewMutation();
  const session = await assertTimeAccess();
  if (
    !isSupervisorRole(session.effectiveRole) &&
    !isAdminTierRole(session.effectiveRole)
  ) {
    throw new Error("Only supervisors can return weeks");
  }

  const trimmed = notes.trim();
  if (!trimmed) {
    throw new Error("Include notes explaining what to fix");
  }

  const admin = requireAdmin();
  const now = new Date().toISOString();

  const { error: weekErr } = await admin
    .from("es_time_week_submissions")
    .update({
      status: "returned",
      supervisor_notes: trimmed,
      approved_at: null,
      approved_by: null,
    })
    .eq("id", weekSubmissionId);

  if (weekErr) {
    throw new Error(weekErr.message);
  }

  const { error: entryErr } = await admin
    .from("es_time_entries")
    .update({
      status: "rejected",
      rejected_reason: trimmed,
      updated_at: now,
    })
    .eq("week_submission_id", weekSubmissionId);

  if (entryErr) {
    throw new Error(entryErr.message);
  }

  revalidatePath("/dashboard/timesheet");
}

export async function addNonClientTimeEntry(
  activityTypeId: string,
  durationMinutes: number,
  serviceDate: string,
  narrative: string
) {
  await assertNotPreviewMutation();
  const session = await assertTimeAccess();
  if (!isEsRole(session.effectiveRole)) {
    throw new Error("Only employment specialists can log time");
  }

  const admin = requireAdmin();
  const { insertEsTimeEntry } = await import("@wayfinder/supabase/es-time-tracking");

  await insertEsTimeEntry(admin, {
    esUserId: session.effectiveUserId,
    clientId: null,
    activityTypeId,
    serviceDate,
    durationMinutes,
    narrative,
    linkedSourceType: "manual",
    linkedSourceId: null,
  });

  revalidatePath("/dashboard/timesheet");
}
