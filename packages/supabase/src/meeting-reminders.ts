import type { createServiceRoleClient } from "./admin-server";
import {
  getClientAndSupportUserIds,
  notifyMeetingReminder,
  type MeetingReminderKind,
} from "./meeting-notify";

type Admin = ReturnType<typeof createServiceRoleClient>;

const REMINDER_WINDOWS: { kind: MeetingReminderKind; minMs: number; maxMs: number }[] = [
  { kind: "day_before", minMs: 23 * 60 * 60 * 1000, maxMs: 25 * 60 * 60 * 1000 },
  { kind: "hour_before", minMs: 50 * 60 * 1000, maxMs: 70 * 60 * 1000 },
];

export type ProcessMeetingRemindersResult = {
  meetingsChecked: number;
  remindersSent: number;
  remindersSkipped: number;
};

export async function processDueMeetingReminders(
  admin: Admin
): Promise<ProcessMeetingRemindersResult> {
  const now = Date.now();
  let meetingsChecked = 0;
  let remindersSent = 0;
  let remindersSkipped = 0;

  for (const window of REMINDER_WINDOWS) {
    const minStart = new Date(now + window.minMs).toISOString();
    const maxStart = new Date(now + window.maxMs).toISOString();

    const { data: meetings, error } = await admin
      .from("client_meeting_requests")
      .select("id, client_id, starts_at, timezone, location, service_id, es_user_id")
      .eq("status", "accepted")
      .gte("starts_at", minStart)
      .lte("starts_at", maxStart);

    if (error) {
      console.error("processDueMeetingReminders load failed:", error.message);
      continue;
    }

    for (const meeting of meetings ?? []) {
      meetingsChecked++;
      const recipients = await getClientAndSupportUserIds(
        admin,
        meeting.client_id as string | null
      );

      for (const recipientUserId of recipients) {
        const { data: existing } = await admin
          .from("meeting_reminder_sends")
          .select("id")
          .eq("meeting_id", meeting.id)
          .eq("recipient_user_id", recipientUserId)
          .eq("reminder_kind", window.kind)
          .maybeSingle();

        if (existing) {
          remindersSkipped++;
          continue;
        }

        try {
          await notifyMeetingReminder(
            admin,
            {
              id: meeting.id as string,
              client_id: meeting.client_id as string | null,
              starts_at: meeting.starts_at as string,
              timezone: meeting.timezone as string,
              location: meeting.location as string,
              service_id: meeting.service_id as string | null,
              es_user_id: meeting.es_user_id as string | null,
            },
            window.kind,
            recipientUserId
          );

          const { error: trackErr } = await admin.from("meeting_reminder_sends").insert({
            meeting_id: meeting.id,
            recipient_user_id: recipientUserId,
            reminder_kind: window.kind,
          });

          if (trackErr && !trackErr.message.includes("duplicate")) {
            console.error("meeting_reminder_sends insert failed:", trackErr.message);
          } else {
            remindersSent++;
          }
        } catch (err) {
          console.error("notifyMeetingReminder failed:", err);
        }
      }
    }
  }

  return { meetingsChecked, remindersSent, remindersSkipped };
}
