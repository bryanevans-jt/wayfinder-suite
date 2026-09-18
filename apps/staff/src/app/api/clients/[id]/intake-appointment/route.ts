import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import {
  INTAKE_APPOINTMENT_TIMEZONE,
  scheduleClientIntakeAppointment,
} from "@wayfinder/supabase/intake-scheduling";
import {
  canEditClientIntakeAppointment,
  isAdminTierRole,
  isFieldSpecialistRole,
  isHrRole,
  isHospitalitySpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
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
    isHospitalitySpecialistRole(role) || isHrRole(role) || isAdminTierRole(role);
  if (!orgWide && (isFieldSpecialistRole(role) || isSupervisorRole(role))) {
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

function parseBody(body: {
  scheduledAt?: string | null;
  location?: string | null;
  timezone?: string | null;
}) {
  const scheduledAt = (body.scheduledAt ?? "").trim() || null;
  const location = (body.location ?? "").trim();
  const timezone =
    (body.timezone ?? "").trim() || INTAKE_APPOINTMENT_TIMEZONE;
  return { scheduledAt, location, timezone };
}

export async function POST(request: Request, context: RouteContext) {
  const { id: clientId } = await context.params;
  const auth = await assertCanEditIntakeAppointment(clientId);
  if ("error" in auth) return auth.error;

  const body = parseBody((await request.json()) as Parameters<typeof parseBody>[0]);
  if (!body.scheduledAt) {
    return NextResponse.json({ error: "Intake date and time are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const result = await scheduleClientIntakeAppointment(admin, {
    clientId,
    scheduledAt: body.scheduledAt,
    location: body.location,
    timezone: body.timezone,
    actorUserId: auth.session.effectiveUserId,
    deliverReminder: deliverIntakeAppointmentReminder,
    replaceScheduledAt: false,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    appointment: {
      id: result.taskId,
      startsAt: body.scheduledAt,
      location: body.location,
      timezone: body.timezone,
    },
    reminder: result.reminder,
  });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id: clientId } = await context.params;
  const auth = await assertCanEditIntakeAppointment(clientId);
  if ("error" in auth) return auth.error;

  const body = parseBody((await request.json()) as Parameters<typeof parseBody>[0]);
  if (!body.scheduledAt) {
    return NextResponse.json({ error: "Intake date and time are required." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: task } = await admin
    .from("hospitality_intake_tasks")
    .select("id, appointment_starts_at")
    .eq("client_id", clientId)
    .maybeSingle();

  if (!task?.appointment_starts_at) {
    return NextResponse.json(
      { error: "No scheduled intake appointment found. Use Schedule intake first." },
      { status: 404 }
    );
  }

  const result = await scheduleClientIntakeAppointment(admin, {
    clientId,
    scheduledAt: body.scheduledAt,
    location: body.location,
    timezone: body.timezone,
    actorUserId: auth.session.effectiveUserId,
    deliverReminder: deliverIntakeAppointmentReminder,
    replaceScheduledAt: true,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    appointment: {
      id: result.taskId,
      startsAt: body.scheduledAt,
      location: body.location,
      timezone: body.timezone,
    },
    reminder: result.reminder,
  });
}
