import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureScheduledIntakeBilling,
  markIntakeReadyIfContactLogsExist,
} from "./intake-billing";
import {
  resetIntakeAppointmentReminderSchedule,
  sendIntakeAppointmentReminder,
  type DeliverIntakeReminder,
} from "./intake-appointment-reminders";

export const INTAKE_APPOINTMENT_TIMEZONE = "America/New_York";

/** Schedule or reschedule intake on a client profile (Eastern US). */
export async function scheduleClientIntakeAppointment(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    scheduledAt: string;
    location: string;
    timezone?: string;
    actorUserId?: string | null;
    deliverReminder: DeliverIntakeReminder;
    /** When true, replace billing row for an existing appointment time. */
    replaceScheduledAt?: boolean;
  }
): Promise<
  | {
      ok: true;
      taskId: string;
      reminder: { sent: number; skipped: number; errors: string[] };
    }
  | { error: string }
> {
  const scheduledAt = opts.scheduledAt.trim();
  const location = opts.location.trim();
  const timezone = (opts.timezone ?? INTAKE_APPOINTMENT_TIMEZONE).trim() || INTAKE_APPOINTMENT_TIMEZONE;

  if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
    return { error: "Invalid intake date/time." };
  }
  if (!location) {
    return { error: "Intake location is required." };
  }

  const nowIso = new Date().toISOString();
  const { data: existing } = await admin
    .from("hospitality_intake_tasks")
    .select("id, appointment_starts_at")
    .eq("client_id", opts.clientId)
    .maybeSingle();

  let taskId: string;
  const hadAppointment = Boolean(existing?.appointment_starts_at);

  if (existing?.id) {
    taskId = existing.id as string;
    const { error: updateErr } = await admin
      .from("hospitality_intake_tasks")
      .update({
        status: "completed",
        completed_at: nowIso,
        completed_by: opts.actorUserId ?? null,
        appointment_starts_at: scheduledAt,
        appointment_location: location,
        appointment_timezone: timezone,
      })
      .eq("id", taskId);
    if (updateErr) return { error: updateErr.message };
  } else {
    const { data: inserted, error: insertErr } = await admin
      .from("hospitality_intake_tasks")
      .insert({
        client_id: opts.clientId,
        status: "completed",
        created_at: nowIso,
        completed_at: nowIso,
        completed_by: opts.actorUserId ?? null,
        appointment_starts_at: scheduledAt,
        appointment_location: location,
        appointment_timezone: timezone,
      })
      .select("id")
      .single();
    if (insertErr || !inserted?.id) {
      return { error: insertErr?.message ?? "Could not create intake task." };
    }
    taskId = inserted.id as string;
  }

  const billing = await ensureScheduledIntakeBilling(admin, {
    clientId: opts.clientId,
    hospitalityTaskId: taskId,
    scheduledAt,
    replaceScheduledAt: opts.replaceScheduledAt ?? hadAppointment,
  });
  if ("error" in billing) return { error: billing.error };

  await markIntakeReadyIfContactLogsExist(admin, {
    clientId: opts.clientId,
    reason: "contact_log",
  });

  if (hadAppointment) {
    await resetIntakeAppointmentReminderSchedule(admin, taskId);
  }

  const reminder = await sendIntakeAppointmentReminder(admin, {
    hospitalityTaskId: taskId,
    clientId: opts.clientId,
    startsAt: scheduledAt,
    location,
    timezone,
    kind: "scheduled",
    deliver: opts.deliverReminder,
  });

  return {
    ok: true,
    taskId,
    reminder: {
      sent: reminder.sent,
      skipped: reminder.skipped,
      errors: reminder.errors,
    },
  };
}
