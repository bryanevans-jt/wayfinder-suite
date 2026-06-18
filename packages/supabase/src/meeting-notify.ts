import type { createServiceRoleClient } from "./admin-server";
import { notifyUser } from "./notify-user";

type Admin = ReturnType<typeof createServiceRoleClient>;

type MeetingRow = {
  id: string;
  client_id: string | null;
  starts_at: string;
  timezone: string;
  location: string;
  service_id?: string | null;
  es_user_id?: string | null;
};

export function formatMeetingWhen(startsAt: string, timezone: string): string {
  try {
    return new Date(startsAt).toLocaleString("en-US", {
      timeZone: timezone || "America/New_York",
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return startsAt;
  }
}

export async function getClientAndSupportUserIds(
  admin: Admin,
  clientId: string | null
): Promise<string[]> {
  if (!clientId) {
    return [];
  }

  const ids = new Set<string>();

  const { data: client } = await admin
    .from("clients")
    .select("user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();

  const clientUserId =
    (client?.user_id as string | null) ?? (client?.profile_id as string | null) ?? null;
  if (clientUserId) {
    ids.add(clientUserId);
  }

  const { data: supports } = await admin
    .from("support_client_assignments")
    .select("support_user_id")
    .eq("client_id", clientId);

  for (const row of supports ?? []) {
    const supportUserId = row.support_user_id as string | null;
    if (supportUserId) {
      ids.add(supportUserId);
    }
  }

  return [...ids];
}

async function meetingDisplayContext(
  admin: Admin,
  meeting: MeetingRow
): Promise<{ serviceName: string | null; esName: string | null; when: string }> {
  let serviceName: string | null = null;
  let esName: string | null = null;

  if (meeting.service_id) {
    const { data: svc } = await admin
      .from("services")
      .select("name")
      .eq("id", meeting.service_id)
      .maybeSingle();
    serviceName = (svc?.name as string | null) ?? null;
  }

  if (meeting.es_user_id) {
    const { data: esProfile } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", meeting.es_user_id)
      .maybeSingle();
    esName = (esProfile?.full_name as string | null) ?? null;
  }

  return {
    serviceName,
    esName,
    when: formatMeetingWhen(meeting.starts_at, meeting.timezone),
  };
}

function meetingSummary(
  ctx: { serviceName: string | null; esName: string | null },
  location: string
): string {
  const label = ctx.serviceName?.trim() || "Wayfinder service";
  const withEs = ctx.esName ? ` with ${ctx.esName}` : "";
  return `${label} meeting${withEs} at ${location}`;
}

/** Notify client and natural supports that a meeting is confirmed. */
export async function notifyMeetingConfirmed(
  admin: Admin,
  meeting: MeetingRow
): Promise<void> {
  const ctx = await meetingDisplayContext(admin, meeting);
  const summary = meetingSummary(ctx, meeting.location);
  const title = "Meeting confirmed";
  const body = `${summary} on ${ctx.when}.`;

  const recipients = await getClientAndSupportUserIds(admin, meeting.client_id);
  for (const userId of recipients) {
    await notifyUser(admin, {
      userId,
      kind: "meeting_confirmed",
      title,
      body,
      link_path: "/dashboard",
      metadata: { meeting_id: meeting.id },
      app: "client",
    });
  }
}

export type MeetingReminderKind = "day_before" | "hour_before";

export async function notifyMeetingReminder(
  admin: Admin,
  meeting: MeetingRow,
  reminderKind: MeetingReminderKind,
  recipientUserId: string
): Promise<void> {
  const ctx = await meetingDisplayContext(admin, meeting);
  const summary = meetingSummary(ctx, meeting.location);
  const title =
    reminderKind === "day_before" ? "Meeting tomorrow" : "Meeting in about an hour";
  const prefix = reminderKind === "day_before" ? "Reminder: " : "Starting soon: ";
  const body = `${prefix}${summary} on ${ctx.when}.`;

  await notifyUser(admin, {
    userId: recipientUserId,
    kind: `meeting_reminder_${reminderKind}`,
    title,
    body,
    link_path: "/dashboard",
    metadata: { meeting_id: meeting.id, reminder_kind: reminderKind },
    app: "client",
  });
}
