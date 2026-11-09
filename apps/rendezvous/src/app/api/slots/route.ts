import { createAdminClient } from "@/lib/supabase/admin";
import { loadPublicSlots } from "@/lib/booking-service";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug")?.trim();
  if (!slug) {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const days = Math.min(Number(url.searchParams.get("days") ?? "14") || 14, 90);
  const now = new Date();
  const rangeStart = now;
  const rangeEnd = new Date(now.getTime() + days * 86_400_000);

  try {
    const admin = createAdminClient();
    const result = await loadPublicSlots({ admin, slug, rangeStart, rangeEnd, now });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      staffName: result.staffName,
      defaultLocation: result.defaultLocation,
      meetingLengthMinutes: result.schedule.meeting_length_minutes,
      timezone: result.schedule.timezone,
      slots: result.slots.map((s) => ({
        start: s.start.toISOString(),
        end: s.end.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/slots failed:", err);
    const message = err instanceof Error ? err.message : "Unable to load times";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
