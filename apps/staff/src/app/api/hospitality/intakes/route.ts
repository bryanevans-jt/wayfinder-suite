import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHospitalitySpecialistRole,
  isHrRole,
} from "@wayfinder/supabase/roles";
import {
  ensureScheduledIntakeBilling,
  markIntakeReadyIfContactLogsExist,
  markIntakeReadyToBill,
} from "@wayfinder/supabase/intake-billing";
import { sendIntakeAppointmentReminder } from "@wayfinder/supabase/intake-appointment-reminders";
import { deliverIntakeAppointmentReminder } from "@/lib/intake-appointment-email";
import { NextResponse } from "next/server";

function canAccessIntakes(role: string | null | undefined) {
  return isHospitalitySpecialistRole(role) || isHrRole(role) || isAdminTierRole(role);
}

export async function GET(request: Request) {
  const session = await getAppSession();
  if (!session || !canAccessIntakes(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = new URL(request.url).searchParams.get("status") || "open";
  const admin = createServiceRoleClient();
  let query = admin
    .from("hospitality_intake_tasks")
    .select(
      "id, status, created_at, completed_at, client_id, appointment_starts_at, appointment_location, appointment_timezone"
    )
    .order("created_at", { ascending: true });

  if (status === "open" || status === "completed") {
    query = query.eq("status", status);
  } else {
    query = query.order("status", { ascending: true });
  }

  const { data: tasks, error } = await query.limit(300);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((tasks ?? []).map((t) => t.client_id as string))];
  const { data: clients } = clientIds.length
    ? await admin
        .from("clients")
        .select("id, full_name, contact_email, primary_phone")
        .in("id", clientIds)
    : {
        data: [] as {
          id: string;
          full_name: string | null;
          contact_email: string | null;
          primary_phone: string | null;
        }[],
      };

  const byId = Object.fromEntries((clients ?? []).map((c) => [c.id, c]));
  const enriched = (tasks ?? []).map((t) => ({
    ...t,
    client: byId[t.client_id as string] ?? null,
  }));

  if (status === "all") {
    enriched.sort((a, b) => {
      if (a.status !== b.status) return a.status === "open" ? -1 : 1;
      return new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime();
    });
  }

  return NextResponse.json({ tasks: enriched });
}

export async function PATCH(request: Request) {
  const session = await getAppSession();
  if (!session || !canAccessIntakes(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as {
    taskId?: string;
    action?: "complete";
    scheduledAt?: string | null;
    location?: string | null;
    timezone?: string | null;
  };
  if (!body.taskId || body.action !== "complete") {
    return NextResponse.json({ error: "taskId and action=complete required" }, { status: 400 });
  }

  const scheduledAt = (body.scheduledAt ?? "").trim() || null;
  const location = (body.location ?? "").trim();
  const timezone = (body.timezone ?? "").trim() || "America/New_York";

  if (!scheduledAt) {
    return NextResponse.json(
      { error: "Intake date and time are required so the client can be reminded." },
      { status: 400 }
    );
  }
  if (!location) {
    return NextResponse.json(
      { error: "Intake location is required for client reminders." },
      { status: 400 }
    );
  }
  const startsMs = new Date(scheduledAt).getTime();
  if (Number.isNaN(startsMs)) {
    return NextResponse.json({ error: "Invalid intake date/time." }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  const { data: task, error: loadErr } = await admin
    .from("hospitality_intake_tasks")
    .select("id, client_id")
    .eq("id", body.taskId)
    .maybeSingle();
  if (loadErr || !task) {
    return NextResponse.json({ error: loadErr?.message ?? "Task not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("hospitality_intake_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      completed_by: session.effectiveUserId,
      appointment_starts_at: scheduledAt,
      appointment_location: location,
      appointment_timezone: timezone,
    })
    .eq("id", body.taskId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientId = task.client_id as string;
  const created = await ensureScheduledIntakeBilling(admin, {
    clientId,
    hospitalityTaskId: task.id as string,
    scheduledAt,
  });
  if ("error" in created) {
    return NextResponse.json({ error: created.error }, { status: 500 });
  }

  if (startsMs <= Date.now()) {
    await markIntakeReadyToBill(admin, {
      clientId,
      reason: "scheduled_time",
    });
  } else {
    await markIntakeReadyIfContactLogsExist(admin, {
      clientId,
      reason: "contact_log",
    });
  }

  const reminder = await sendIntakeAppointmentReminder(admin, {
    hospitalityTaskId: task.id as string,
    clientId,
    startsAt: scheduledAt,
    location,
    timezone,
    kind: "scheduled",
    deliver: deliverIntakeAppointmentReminder,
  });

  return NextResponse.json({
    ok: true,
    reminder: {
      sent: reminder.sent,
      skipped: reminder.skipped,
      errors: reminder.errors,
    },
  });
}
