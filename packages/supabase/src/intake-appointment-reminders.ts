import type { SupabaseClient } from "@supabase/supabase-js";

export type IntakeReminderKind = "scheduled" | "day_before" | "hour_before";

/** Active reminder channels. Add "sms" here when Twilio (or carrier SMS) is approved. */
export const INTAKE_REMINDER_CHANNELS = ["email"] as const;
export type IntakeReminderChannel = (typeof INTAKE_REMINDER_CHANNELS)[number] | "sms";

export type IntakeAppointmentReminderMessage = {
  hospitalityTaskId: string;
  clientId: string;
  clientName: string;
  toEmail: string | null;
  toPhone: string | null;
  kind: IntakeReminderKind;
  channel: IntakeReminderChannel;
  subject: string;
  text: string;
  startsAt: string;
  location: string;
  timezone: string;
};

export type DeliverIntakeReminder = (
  message: IntakeAppointmentReminderMessage
) => Promise<{ ok: true } | { ok: false; error: string; skip?: boolean }>;

const REMINDER_WINDOWS: { kind: Exclude<IntakeReminderKind, "scheduled">; minMs: number; maxMs: number }[] =
  [
    { kind: "day_before", minMs: 23 * 60 * 60 * 1000, maxMs: 25 * 60 * 60 * 1000 },
    { kind: "hour_before", minMs: 50 * 60 * 1000, maxMs: 70 * 60 * 1000 },
  ];

function formatWhen(startsAt: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "America/New_York",
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(startsAt));
  } catch {
    return new Date(startsAt).toLocaleString();
  }
}

export async function buildIntakeAppointmentReminderCopy(
  admin: SupabaseClient,
  opts: {
    kind: IntakeReminderKind;
    clientName: string;
    startsAt: string;
    location: string;
    timezone: string;
  }
): Promise<{ subject: string; text: string }> {
  const { loadResolvedEmailTemplate, renderFlatEmail } = await import("./email-templates");
  const key =
    opts.kind === "scheduled"
      ? "intake_appointment_scheduled"
      : opts.kind === "day_before"
        ? "intake_appointment_day_before"
        : "intake_appointment_hour_before";
  const resolved = await loadResolvedEmailTemplate(admin, key);
  return renderFlatEmail(resolved, {
    client_name: opts.clientName.trim() || "there",
    appointment_when: formatWhen(opts.startsAt, opts.timezone),
    appointment_location: opts.location.trim() || "Location to be confirmed",
  });
}

async function alreadySent(
  admin: SupabaseClient,
  opts: { hospitalityTaskId: string; kind: IntakeReminderKind; channel: IntakeReminderChannel }
): Promise<boolean> {
  const { data } = await admin
    .from("intake_appointment_reminder_sends")
    .select("id")
    .eq("hospitality_task_id", opts.hospitalityTaskId)
    .eq("reminder_kind", opts.kind)
    .eq("channel", opts.channel)
    .maybeSingle();
  return Boolean(data?.id);
}

async function recordSend(
  admin: SupabaseClient,
  opts: { hospitalityTaskId: string; kind: IntakeReminderKind; channel: IntakeReminderChannel }
): Promise<void> {
  const { error } = await admin.from("intake_appointment_reminder_sends").insert({
    hospitality_task_id: opts.hospitalityTaskId,
    reminder_kind: opts.kind,
    channel: opts.channel,
  });
  if (error && !error.message.includes("duplicate") && error.code !== "23505") {
    console.error("intake_appointment_reminder_sends insert failed:", error.message);
  }
}

type AppointmentRow = {
  id: string;
  client_id: string;
  appointment_starts_at: string;
  appointment_location: string | null;
  appointment_timezone: string | null;
};

async function loadClientContact(
  admin: SupabaseClient,
  clientId: string
): Promise<{ full_name: string | null; contact_email: string | null; primary_phone: string | null }> {
  const { data } = await admin
    .from("clients")
    .select("full_name, contact_email, primary_phone")
    .eq("id", clientId)
    .maybeSingle();
  return {
    full_name: (data?.full_name as string | null) ?? null,
    contact_email: (data?.contact_email as string | null) ?? null,
    primary_phone: (data?.primary_phone as string | null) ?? null,
  };
}

export async function sendIntakeAppointmentReminder(
  admin: SupabaseClient,
  opts: {
    hospitalityTaskId: string;
    clientId: string;
    startsAt: string;
    location: string;
    timezone?: string | null;
    kind: IntakeReminderKind;
    channels?: IntakeReminderChannel[];
    deliver: DeliverIntakeReminder;
  }
): Promise<{ sent: number; skipped: number; errors: string[] }> {
  const channels = opts.channels ?? [...INTAKE_REMINDER_CHANNELS];
  const timezone = (opts.timezone ?? "").trim() || "America/New_York";
  const client = await loadClientContact(admin, opts.clientId);
  const copy = await buildIntakeAppointmentReminderCopy(admin, {
    kind: opts.kind,
    clientName: client.full_name || "there",
    startsAt: opts.startsAt,
    location: opts.location,
    timezone,
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    if (await alreadySent(admin, { hospitalityTaskId: opts.hospitalityTaskId, kind: opts.kind, channel })) {
      skipped += 1;
      continue;
    }

    const message: IntakeAppointmentReminderMessage = {
      hospitalityTaskId: opts.hospitalityTaskId,
      clientId: opts.clientId,
      clientName: client.full_name || "Client",
      toEmail: client.contact_email?.trim() || null,
      toPhone: client.primary_phone?.trim() || null,
      kind: opts.kind,
      channel,
      subject: copy.subject,
      text: copy.text,
      startsAt: opts.startsAt,
      location: opts.location,
      timezone,
    };

    const result = await opts.deliver(message);
    if (!result.ok) {
      if (result.skip) {
        skipped += 1;
      } else {
        errors.push(result.error);
      }
      continue;
    }

    await recordSend(admin, {
      hospitalityTaskId: opts.hospitalityTaskId,
      kind: opts.kind,
      channel,
    });
    sent += 1;
  }

  return { sent, skipped, errors };
}

export type ProcessIntakeAppointmentRemindersResult = {
  appointmentsChecked: number;
  remindersSent: number;
  remindersSkipped: number;
  errors: string[];
};

/** Cron: send day-before and hour-before reminders for upcoming intake appointments. */
export async function processDueIntakeAppointmentReminders(
  admin: SupabaseClient,
  deliver: DeliverIntakeReminder
): Promise<ProcessIntakeAppointmentRemindersResult> {
  const now = Date.now();
  let appointmentsChecked = 0;
  let remindersSent = 0;
  let remindersSkipped = 0;
  const errors: string[] = [];

  for (const window of REMINDER_WINDOWS) {
    const minStart = new Date(now + window.minMs).toISOString();
    const maxStart = new Date(now + window.maxMs).toISOString();

    const { data: rows, error } = await admin
      .from("hospitality_intake_tasks")
      .select("id, client_id, appointment_starts_at, appointment_location, appointment_timezone")
      .not("appointment_starts_at", "is", null)
      .gte("appointment_starts_at", minStart)
      .lte("appointment_starts_at", maxStart);

    if (error) {
      console.error("processDueIntakeAppointmentReminders load failed:", error.message);
      errors.push(error.message);
      continue;
    }

    for (const row of (rows ?? []) as AppointmentRow[]) {
      appointmentsChecked += 1;
      const location = (row.appointment_location ?? "").trim();
      if (!location || !row.appointment_starts_at) {
        remindersSkipped += 1;
        continue;
      }

      const result = await sendIntakeAppointmentReminder(admin, {
        hospitalityTaskId: row.id,
        clientId: row.client_id,
        startsAt: row.appointment_starts_at,
        location,
        timezone: row.appointment_timezone,
        kind: window.kind,
        deliver,
      });
      remindersSent += result.sent;
      remindersSkipped += result.skipped;
      errors.push(...result.errors);
    }
  }

  return { appointmentsChecked, remindersSent, remindersSkipped, errors };
}
