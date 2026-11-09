import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicBooking } from "@/lib/booking-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const startsAt = typeof body.startsAt === "string" ? body.startsAt : "";
  const counselorName = typeof body.counselorName === "string" ? body.counselorName : "";
  const counselorEmail = typeof body.counselorEmail === "string" ? body.counselorEmail : "";
  const meetingFormat =
    body.meetingFormat === "google_meet" || body.meetingFormat === "in_person"
      ? body.meetingFormat
      : null;
  const locationOverride =
    typeof body.location === "string" ? body.location : null;
  const reasonRaw = typeof body.reason === "string" ? body.reason.trim() : "";
  const reason =
    reasonRaw === "Intake" || reasonRaw === "Progress Meeting" || reasonRaw === "Other"
      ? reasonRaw
      : null;
  const notes = typeof body.notes === "string" ? body.notes : null;
  const forceTestEmail = body.forceTestEmail === true && process.env.RENDEZVOUS_ALLOW_TEST_EMAIL === "true";

  if (!slug || !startsAt || !meetingFormat || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const admin = createAdminClient();
  const result = await createPublicBooking({
    admin,
    slug,
    startsAtIso: startsAt,
    counselorName,
    counselorEmail,
    meetingFormat,
    locationOverride,
    reason,
    notes,
    forceTestEmail,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    bookingId: result.booking.id,
    whenLabel: result.whenLabel,
    staffName: result.staffName,
    cancelUrl: result.manage.cancelUrl,
    rescheduleUrl: result.manage.rescheduleUrl,
    calendarSyncWarning: result.calendarSyncWarning,
  });
}
