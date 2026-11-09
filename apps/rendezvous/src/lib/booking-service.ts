import type { SupabaseClient } from "@supabase/supabase-js";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { PORTAL_DISPLAY_TIME_ZONE } from "@wayfinder/branding";
import {
  getBusyTimesCached,
  getScheduleBySlug,
  getStaffEmail,
  invalidateBusyCache,
  listConfirmedBookingsInRange,
  listWeeklyHours,
  type BookingRow,
  type StaffScheduleRow,
} from "./db";
import { createBookingEvent, updateBookingEvent } from "./google/calendar";
import { buildBookingEmailBodies, sendSchedulingEmail } from "./google/mail";
import { buildManageUrl, buildPublicBookingUrl, rendezvousAppBaseUrl } from "./env";
import {
  calculateOpenSlots,
  formatSlotEastern,
  hasBookingConflict,
} from "./scheduling/slots";
import { hashBookingToken, issueBookingToken } from "./scheduling/tokens";
import {
  isPublicBookingAllowed,
  loadRendezvousFeatureEnabled,
} from "./access";
import { rendezvousSchema } from "./supabase/admin";

function bookingsTable(admin: SupabaseClient) {
  return rendezvousSchema(admin).from("bookings");
}

export async function loadPublicSlots(opts: {
  admin: SupabaseClient;
  slug: string;
  rangeStart: Date;
  rangeEnd: Date;
  now?: Date;
}) {
  const featureEnabled = await loadRendezvousFeatureEnabled(opts.admin);
  const schedule = await getScheduleBySlug(opts.admin, opts.slug);
  if (!schedule || !isPublicBookingAllowed({ featureEnabled, scheduleEnabled: schedule.enabled })) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const staff = await getStaffEmail(opts.admin, schedule.staff_user_id);
  if (!staff) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const weeklyHours = await listWeeklyHours(opts.admin, schedule.id);
  const busy = await getBusyTimesCached({
    admin: opts.admin,
    staffUserId: schedule.staff_user_id,
    staffEmail: staff.email,
    calendarId: schedule.google_calendar_id,
    timeMin: opts.rangeStart,
    timeMax: opts.rangeEnd,
  });
  const existingBookings = await listConfirmedBookingsInRange(
    opts.admin,
    schedule.staff_user_id,
    opts.rangeStart,
    opts.rangeEnd
  );

  const slots = calculateOpenSlots({
    weeklyHours,
    meetingLengthMinutes: schedule.meeting_length_minutes,
    bufferMinutes: schedule.buffer_minutes,
    minNoticeHours: schedule.min_notice_hours,
    bookingWindowDays: schedule.booking_window_days,
    now: opts.now ?? new Date(),
    rangeStart: opts.rangeStart,
    rangeEnd: opts.rangeEnd,
    busy,
    existingBookings,
    timeZone: schedule.timezone || PORTAL_DISPLAY_TIME_ZONE,
  });

  return {
    ok: true as const,
    schedule,
    staffName: schedule.display_name?.trim() || staff.fullName,
    defaultLocation: schedule.default_location,
    slots,
  };
}

export async function createPublicBooking(opts: {
  admin: SupabaseClient;
  slug: string;
  startsAtIso: string;
  counselorName: string;
  counselorEmail: string;
  meetingFormat: "in_person" | "google_meet";
  locationOverride?: string | null;
  reason?: string | null;
  forceTestEmail?: boolean;
}) {
  const featureEnabled = await loadRendezvousFeatureEnabled(opts.admin);
  const schedule = await getScheduleBySlug(opts.admin, opts.slug);
  if (!schedule || !isPublicBookingAllowed({ featureEnabled, scheduleEnabled: schedule.enabled })) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const startsAt = new Date(opts.startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, status: 400 as const, error: "Invalid start time" };
  }
  const endsAt = new Date(startsAt.getTime() + schedule.meeting_length_minutes * 60_000);

  const counselorName = opts.counselorName.trim();
  const counselorEmail = opts.counselorEmail.trim().toLowerCase();
  if (!counselorName || !counselorEmail.includes("@")) {
    return { ok: false as const, status: 400 as const, error: "Name and email are required" };
  }
  if (opts.reason && opts.reason.length > 500) {
    return { ok: false as const, status: 400 as const, error: "Reason is too long" };
  }

  const staff = await getStaffEmail(opts.admin, schedule.staff_user_id);
  if (!staff) {
    return { ok: false as const, status: 404 as const, error: "Not found" };
  }

  const windowPadStart = new Date(startsAt.getTime() - 24 * 3_600_000);
  const windowPadEnd = new Date(endsAt.getTime() + 24 * 3_600_000);
  const busy = await getBusyTimesCached({
    admin: opts.admin,
    staffUserId: schedule.staff_user_id,
    staffEmail: staff.email,
    calendarId: schedule.google_calendar_id,
    timeMin: windowPadStart,
    timeMax: windowPadEnd,
  });
  const existingBookings = await listConfirmedBookingsInRange(
    opts.admin,
    schedule.staff_user_id,
    windowPadStart,
    windowPadEnd
  );

  if (
    hasBookingConflict({
      start: startsAt,
      end: endsAt,
      bufferMinutes: schedule.buffer_minutes,
      busy,
      existingBookings,
    })
  ) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "That time is no longer available. Please pick another slot.",
    };
  }

  // Ensure the start is still a valid open slot under current rules.
  const open = calculateOpenSlots({
    weeklyHours: await listWeeklyHours(opts.admin, schedule.id),
    meetingLengthMinutes: schedule.meeting_length_minutes,
    bufferMinutes: schedule.buffer_minutes,
    minNoticeHours: schedule.min_notice_hours,
    bookingWindowDays: schedule.booking_window_days,
    now: new Date(),
    rangeStart: startsAt,
    rangeEnd: endsAt,
    busy,
    existingBookings,
    timeZone: schedule.timezone || PORTAL_DISPLAY_TIME_ZONE,
  });
  const stillOpen = open.some((s) => s.start.getTime() === startsAt.getTime());
  if (!stillOpen) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "That time is no longer available. Please pick another slot.",
    };
  }

  const location =
    opts.meetingFormat === "in_person"
      ? (opts.locationOverride?.trim() || schedule.default_location || "To be confirmed")
      : null;

  const cancel = issueBookingToken();
  const reschedule = issueBookingToken();

  const staffName = schedule.display_name?.trim() || staff.fullName;
  const whenLabel = formatSlotEastern({ start: startsAt, end: endsAt });
  const formatLabel = opts.meetingFormat === "in_person" ? "In person" : "Google Meet";

  let googleEventId: string | null = null;
  let meetLink: string | null = null;
  try {
    const event = await createBookingEvent({
      staffEmail: staff.email,
      calendarId: schedule.google_calendar_id,
      summary: `Rendezvous: ${counselorName} ↔ ${staffName}`,
      description: [
        `Counselor: ${counselorName} <${counselorEmail}>`,
        opts.reason?.trim() ? `Note: ${opts.reason.trim()}` : null,
        "Booked via Joshua Tree Rendezvous.",
        "Do not include sensitive client information in calendar notes.",
      ]
        .filter(Boolean)
        .join("\n"),
      location,
      start: startsAt,
      end: endsAt,
      counselorEmail,
      counselorName,
      conference: opts.meetingFormat === "google_meet",
    });
    googleEventId = event.eventId;
    meetLink = event.meetLink;
  } catch (err) {
    return {
      ok: false as const,
      status: 502 as const,
      error: err instanceof Error ? err.message : "Google Calendar error",
    };
  }

  const { data: booking, error } = await bookingsTable(opts.admin)
    .insert({
      schedule_id: schedule.id,
      staff_user_id: schedule.staff_user_id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      counselor_name: counselorName,
      counselor_email: counselorEmail,
      meeting_format: opts.meetingFormat,
      location,
      meet_link: meetLink,
      reason: opts.reason?.trim() || null,
      status: "confirmed",
      google_event_id: googleEventId,
      cancel_token_hash: cancel.hash,
      reschedule_token_hash: reschedule.hash,
    })
    .select("*")
    .single();

  if (error) {
    // Roll back Google event on unique/exclusion conflict or insert failure.
    try {
      if (googleEventId) {
        await updateBookingEvent({
          staffEmail: staff.email,
          calendarId: schedule.google_calendar_id,
          eventId: googleEventId,
          status: "cancelled",
        });
      }
    } catch {
      // best-effort
    }
    if (error.code === "23P01" || error.message.includes("bookings_no_overlap")) {
      return {
        ok: false as const,
        status: 409 as const,
        error: "That time was just booked. Please pick another slot.",
      };
    }
    return { ok: false as const, status: 500 as const, error: error.message };
  }

  await invalidateBusyCache(opts.admin, schedule.staff_user_id);

  const cancelUrl = buildManageUrl("cancel", cancel.token);
  const rescheduleUrl = buildManageUrl("reschedule", reschedule.token);
  const locationOrMeet =
    opts.meetingFormat === "in_person" ? location || "To be confirmed" : meetLink || "Google Meet link pending";

  const bodies = buildBookingEmailBodies({
    staffName,
    counselorName,
    whenLabel,
    formatLabel,
    locationOrMeet,
    cancelUrl,
    rescheduleUrl,
    reason: opts.reason,
  });

  await sendSchedulingEmail({
    to: counselorEmail,
    subject: `Confirmed: meeting with ${staffName}`,
    text: bodies.counselorText,
    forceTestSend: opts.forceTestEmail,
  });
  await sendSchedulingEmail({
    to: staff.email,
    subject: `New booking: ${counselorName}`,
    text: `${bodies.staffText}\nCounselor email: ${counselorEmail}\n`,
    forceTestSend: opts.forceTestEmail,
  });

  // In-app notification — only when feature flag is on (already verified).
  if (featureEnabled) {
    await notifyUser(opts.admin as never, {
      userId: schedule.staff_user_id,
      kind: "rendezvous_booking",
      title: "New Rendezvous booking",
      body: `${counselorName} booked ${whenLabel}`,
      link_path: "/dashboard/rendezvous",
      metadata: { bookingId: (booking as BookingRow).id, source: "rendezvous" },
      app: "staff",
    });
  }

  return {
    ok: true as const,
    booking: booking as BookingRow,
    staffName,
    whenLabel,
    manage: { cancelUrl, rescheduleUrl },
    publicUrl: buildPublicBookingUrl(schedule.slug),
    appUrl: rendezvousAppBaseUrl(),
  };
}

export async function cancelBookingByToken(opts: {
  admin: SupabaseClient;
  token: string;
  forceTestEmail?: boolean;
}) {
  const hash = hashBookingToken(opts.token);
  const { data: booking, error } = await bookingsTable(opts.admin)
    .select("*")
    .eq("cancel_token_hash", hash)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500 as const, error: error.message };
  if (!booking) return { ok: false as const, status: 404 as const, error: "Not found" };
  const row = booking as BookingRow;
  if (row.status !== "confirmed") {
    return { ok: false as const, status: 410 as const, error: "This booking is no longer active." };
  }

  const staff = await getStaffEmail(opts.admin, row.staff_user_id);
  const schedule = await getScheduleBySlugForStaff(opts.admin, row.schedule_id);
  if (staff && row.google_event_id) {
    try {
      await updateBookingEvent({
        staffEmail: staff.email,
        calendarId: schedule?.google_calendar_id ?? "primary",
        eventId: row.google_event_id,
        status: "cancelled",
      });
    } catch {
      // continue — DB cancel still proceeds
    }
  }

  const { error: updErr } = await bookingsTable(opts.admin)
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "confirmed");
  if (updErr) return { ok: false as const, status: 500 as const, error: updErr.message };

  await invalidateBusyCache(opts.admin, row.staff_user_id);

  const whenLabel = formatSlotEastern({
    start: new Date(row.starts_at),
    end: new Date(row.ends_at),
  });
  const staffName = schedule?.display_name || staff?.fullName || "your specialist";

  await sendSchedulingEmail({
    to: row.counselor_email,
    subject: `Cancelled: meeting with ${staffName}`,
    text: `Hi ${row.counselor_name},\n\nYour meeting with ${staffName} on ${whenLabel} was cancelled.\n\n— Joshua Tree Service Group Scheduling`,
    forceTestSend: opts.forceTestEmail,
  });
  if (staff) {
    await sendSchedulingEmail({
      to: staff.email,
      subject: `Cancelled booking: ${row.counselor_name}`,
      text: `Hi ${staffName},\n\n${row.counselor_name} cancelled the meeting on ${whenLabel}.\n\n— Joshua Tree Service Group Scheduling`,
      forceTestSend: opts.forceTestEmail,
    });
  }

  return { ok: true as const, booking: row };
}

export async function rescheduleBookingByToken(opts: {
  admin: SupabaseClient;
  token: string;
  startsAtIso: string;
  forceTestEmail?: boolean;
}) {
  const hash = hashBookingToken(opts.token);
  const { data: booking, error } = await bookingsTable(opts.admin)
    .select("*")
    .eq("reschedule_token_hash", hash)
    .maybeSingle();
  if (error) return { ok: false as const, status: 500 as const, error: error.message };
  if (!booking) return { ok: false as const, status: 404 as const, error: "Not found" };
  const row = booking as BookingRow;
  if (row.status !== "confirmed") {
    return { ok: false as const, status: 410 as const, error: "This booking is no longer active." };
  }

  const schedule = await getScheduleBySlugForStaff(opts.admin, row.schedule_id);
  if (!schedule) return { ok: false as const, status: 404 as const, error: "Not found" };

  const startsAt = new Date(opts.startsAtIso);
  if (Number.isNaN(startsAt.getTime())) {
    return { ok: false as const, status: 400 as const, error: "Invalid start time" };
  }
  const endsAt = new Date(startsAt.getTime() + schedule.meeting_length_minutes * 60_000);
  const staff = await getStaffEmail(opts.admin, row.staff_user_id);
  if (!staff) return { ok: false as const, status: 404 as const, error: "Not found" };

  const windowPadStart = new Date(startsAt.getTime() - 24 * 3_600_000);
  const windowPadEnd = new Date(endsAt.getTime() + 24 * 3_600_000);
  const busy = await getBusyTimesCached({
    admin: opts.admin,
    staffUserId: schedule.staff_user_id,
    staffEmail: staff.email,
    calendarId: schedule.google_calendar_id,
    timeMin: windowPadStart,
    timeMax: windowPadEnd,
  });
  const existingBookings = (
    await listConfirmedBookingsInRange(
      opts.admin,
      schedule.staff_user_id,
      windowPadStart,
      windowPadEnd
    )
  ).filter(
    (b) =>
      !(
        b.start.getTime() === new Date(row.starts_at).getTime() &&
        b.end.getTime() === new Date(row.ends_at).getTime()
      )
  );

  if (
    hasBookingConflict({
      start: startsAt,
      end: endsAt,
      bufferMinutes: schedule.buffer_minutes,
      busy,
      existingBookings,
    })
  ) {
    return {
      ok: false as const,
      status: 409 as const,
      error: "That time is no longer available. Please pick another slot.",
    };
  }

  if (row.google_event_id) {
    await updateBookingEvent({
      staffEmail: staff.email,
      calendarId: schedule.google_calendar_id,
      eventId: row.google_event_id,
      start: startsAt,
      end: endsAt,
    });
  }

  const { data: updated, error: updErr } = await bookingsTable(opts.admin)
    .update({
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    })
    .eq("id", row.id)
    .eq("status", "confirmed")
    .select("*")
    .single();
  if (updErr) {
    return { ok: false as const, status: 500 as const, error: updErr.message };
  }

  await invalidateBusyCache(opts.admin, row.staff_user_id);

  const staffName = schedule.display_name?.trim() || staff.fullName;
  const whenLabel = formatSlotEastern({ start: startsAt, end: endsAt });
  await sendSchedulingEmail({
    to: row.counselor_email,
    subject: `Rescheduled: meeting with ${staffName}`,
    text: `Hi ${row.counselor_name},\n\nYour meeting with ${staffName} was moved to ${whenLabel}.\n\n— Joshua Tree Service Group Scheduling`,
    forceTestSend: opts.forceTestEmail,
  });
  await sendSchedulingEmail({
    to: staff.email,
    subject: `Rescheduled booking: ${row.counselor_name}`,
    text: `Hi ${staffName},\n\n${row.counselor_name} rescheduled to ${whenLabel}.\n\n— Joshua Tree Service Group Scheduling`,
    forceTestSend: opts.forceTestEmail,
  });

  return { ok: true as const, booking: updated as BookingRow, whenLabel };
}

async function getScheduleBySlugForStaff(
  admin: SupabaseClient,
  scheduleId: string
): Promise<StaffScheduleRow | null> {
  const { data, error } = await rendezvousSchema(admin)
    .from("staff_schedules")
    .select("*")
    .eq("id", scheduleId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as StaffScheduleRow | null) ?? null;
}
