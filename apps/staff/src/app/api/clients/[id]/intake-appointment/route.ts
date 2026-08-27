import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  canEditClientIntakeAppointment,
  isAdminTierRole,
  isEsRole,
  isHospitalitySpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { ensureScheduledIntakeBilling } from "@wayfinder/supabase/intake-billing";
import {
  resetIntakeAppointmentReminderSchedule,
  sendIntakeAppointmentReminder,
} from "@wayfinder/supabase/intake-appointment-reminders";
import { deliverIntakeAppointmentReminder } from "@/lib/intake-appointment-email";
import { requireStaffClientAccess } from "@/lib/app-session";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

async function assertCanEditIntakeAppointment(clientId: string) {
  const session = await getAppSession();
  if (!session || !canEditClientIntakeAppointment(session.effectiveRole)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const role = session.effectiveRole;
  const orgWide =
    isHospitalitySpecialistRole(role) || isAdminTierRole(role);
  if (!orgWide && (isEsRole(role) || isSupervisorRole(role))) {
    const ok = await requireStaffClientAccess(session, clientId);
    if (!ok) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
    }
  }

  try {
    await assertNotPreviewMutation();
  } catch {
    return {
      error: NextResponse.json({ error: "Exit preview to make changes." }, { status: 403 }),
    };
  }

  return { session };
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: clientId } = await context.params;
  const auth = await assertCanEditIntakeAppointment(clientId);
  if ("error" in auth) return auth.error;

  const body = (await request.json()) as {
    scheduledAt?: string | null;
    location?: string | null;
    timezone?: string | null;
  };

  const scheduledAt = (body.scheduledAt ?? "").trim() || null;
  const location = (body.location ?? "").trim();
  const timezone = (body.timezone ?? "").trim() || "America/New_York";

  if (!scheduledAt) {
    return NextResponse.json({ error: "Intake date and time are required." }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "Intake location is required." }, { status: 400 });
  }
  if (Number.isNaN(new Date(scheduledAt).getTime())) {
    return NextResponse.json({ error: "Invalid intake date/time." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: task, error: loadErr } = await admin
    .from("hospitality_intake_tasks")
    .select("id, client_id, appointment_starts_at")
    .eq("client_id", clientId)
    .not("appointment_starts_at", "is", null)
    .order("appointment_starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (loadErr || !task) {
    return NextResponse.json(
      { error: loadErr?.message ?? "No scheduled intake appointment found for this client." },
      { status: 404 }
    );
  }

  const taskId = task.id as string;
  const { error: updateErr } = await admin
    .from("hospitality_intake_tasks")
    .update({
      appointment_starts_at: scheduledAt,
      appointment_location: location,
      appointment_timezone: timezone,
    })
    .eq("id", taskId);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const billing = await ensureScheduledIntakeBilling(admin, {
    clientId,
    hospitalityTaskId: taskId,
    scheduledAt,
    replaceScheduledAt: true,
  });
  if ("error" in billing) {
    return NextResponse.json({ error: billing.error }, { status: 500 });
  }

  await resetIntakeAppointmentReminderSchedule(admin, taskId);

  const reminder = await sendIntakeAppointmentReminder(admin, {
    hospitalityTaskId: taskId,
    clientId,
    startsAt: scheduledAt,
    location,
    timezone,
    kind: "scheduled",
    deliver: deliverIntakeAppointmentReminder,
  });

  return NextResponse.json({
    ok: true,
    appointment: {
      id: taskId,
      startsAt: scheduledAt,
      location,
      timezone,
    },
    reminder: {
      sent: reminder.sent,
      skipped: reminder.skipped,
      errors: reminder.errors,
    },
  });
}
