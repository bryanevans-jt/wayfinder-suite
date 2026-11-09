import { createAdminClient } from "@/lib/supabase/admin";
import { rescheduleBookingByToken } from "@/lib/booking-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const startsAt = typeof body?.startsAt === "string" ? body.startsAt : "";
  if (!token || !startsAt) {
    return NextResponse.json({ error: "Missing token or startsAt" }, { status: 400 });
  }
  const forceTestEmail =
    body?.forceTestEmail === true && process.env.RENDEZVOUS_ALLOW_TEST_EMAIL === "true";

  const admin = createAdminClient();
  const result = await rescheduleBookingByToken({
    admin,
    token,
    startsAtIso: startsAt,
    forceTestEmail,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, whenLabel: result.whenLabel });
}
