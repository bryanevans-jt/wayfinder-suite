import { google, type calendar_v3 } from "googleapis";
import { createHash, randomUUID } from "node:crypto";
import { googleServiceAccountCredentials } from "./credentials";

const FREEBUSY_CACHE_TTL_MS = 90_000; // short TTL; push watches invalidate sooner

export type FreeBusyInterval = { start: Date; end: Date };

/** Service account auth with domain-wide delegation, impersonating a Workspace user. */
export function getCalendarAuthForUser(userEmail: string) {
  const { clientEmail, privateKey } = googleServiceAccountCredentials();
  const subject = userEmail.trim().toLowerCase();
  if (!subject) throw new Error("Staff Google email required for Calendar impersonation");

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.freebusy",
    ],
    subject,
  });
}

export function getCalendarClientForUser(userEmail: string) {
  return google.calendar({ version: "v3", auth: getCalendarAuthForUser(userEmail) });
}

export async function fetchFreeBusy(opts: {
  staffEmail: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
}): Promise<FreeBusyInterval[]> {
  const calendar = getCalendarClientForUser(opts.staffEmail);
  const calendarId = opts.calendarId ?? "primary";
  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: opts.timeMin.toISOString(),
      timeMax: opts.timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });
  const busy = res.data.calendars?.[calendarId]?.busy ?? [];
  return busy
    .filter((b): b is { start: string; end: string } => Boolean(b.start && b.end))
    .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

export async function createBookingEvent(opts: {
  staffEmail: string;
  calendarId?: string;
  summary: string;
  description: string;
  location?: string | null;
  start: Date;
  end: Date;
  counselorEmail: string;
  counselorName: string;
  conference?: boolean;
}): Promise<{ eventId: string; meetLink: string | null }> {
  const calendar = getCalendarClientForUser(opts.staffEmail);
  const calendarId = opts.calendarId ?? "primary";
  const requestBody: calendar_v3.Schema$Event = {
    summary: opts.summary,
    description: opts.description,
    location: opts.location ?? undefined,
    start: { dateTime: opts.start.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: opts.end.toISOString(), timeZone: "America/New_York" },
    attendees: [
      {
        email: opts.counselorEmail,
        displayName: opts.counselorName,
      },
    ],
    reminders: { useDefault: true },
  };

  if (opts.conference) {
    requestBody.conferenceData = {
      createRequest: {
        requestId: randomUUID(),
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const res = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: opts.conference ? 1 : 0,
    sendUpdates: "all",
    requestBody,
  });

  const eventId = res.data.id;
  if (!eventId) throw new Error("Google Calendar did not return an event id");

  const meetLink =
    res.data.hangoutLink ??
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ??
    null;

  return { eventId, meetLink };
}

export async function updateBookingEvent(opts: {
  staffEmail: string;
  calendarId?: string;
  eventId: string;
  start?: Date;
  end?: Date;
  summary?: string;
  description?: string;
  location?: string | null;
  status?: "confirmed" | "cancelled";
}): Promise<void> {
  const calendar = getCalendarClientForUser(opts.staffEmail);
  const calendarId = opts.calendarId ?? "primary";

  if (opts.status === "cancelled") {
    await calendar.events.delete({
      calendarId,
      eventId: opts.eventId,
      sendUpdates: "all",
    });
    return;
  }

  const patch: calendar_v3.Schema$Event = {};
  if (opts.start) {
    patch.start = { dateTime: opts.start.toISOString(), timeZone: "America/New_York" };
  }
  if (opts.end) {
    patch.end = { dateTime: opts.end.toISOString(), timeZone: "America/New_York" };
  }
  if (opts.summary) patch.summary = opts.summary;
  if (opts.description) patch.description = opts.description;
  if (opts.location !== undefined) patch.location = opts.location ?? undefined;

  await calendar.events.patch({
    calendarId,
    eventId: opts.eventId,
    sendUpdates: "all",
    requestBody: patch,
  });
}

export async function watchPrimaryCalendar(opts: {
  staffEmail: string;
  calendarId?: string;
  webhookUrl: string;
  channelToken: string;
}): Promise<{ channelId: string; resourceId: string; expiration: Date }> {
  const calendar = getCalendarClientForUser(opts.staffEmail);
  const channelId = randomUUID();
  const res = await calendar.events.watch({
    calendarId: opts.calendarId ?? "primary",
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: opts.webhookUrl,
      token: opts.channelToken,
    },
  });
  const resourceId = res.data.resourceId;
  const expirationMs = Number(res.data.expiration ?? 0);
  if (!resourceId || !expirationMs) {
    throw new Error("Google Calendar watch channel missing resourceId/expiration");
  }
  return {
    channelId,
    resourceId,
    expiration: new Date(expirationMs),
  };
}

export async function stopWatchChannel(opts: {
  staffEmail: string;
  channelId: string;
  resourceId: string;
}): Promise<void> {
  const calendar = getCalendarClientForUser(opts.staffEmail);
  await calendar.channels.stop({
    requestBody: {
      id: opts.channelId,
      resourceId: opts.resourceId,
    },
  });
}

export function freeBusyCacheKey(staffUserId: string, timeMin: Date, timeMax: Date): string {
  return createHash("sha256")
    .update(`${staffUserId}|${timeMin.toISOString()}|${timeMax.toISOString()}`)
    .digest("hex");
}

export { FREEBUSY_CACHE_TTL_MS };
