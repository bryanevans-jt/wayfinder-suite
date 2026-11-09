import { createAdminClient } from "@/lib/supabase/admin";
import { cancelBookingByToken } from "@/lib/booking-service";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }
  const forceTestEmail =
    body?.forceTestEmail === true && process.env.RENDEZVOUS_ALLOW_TEST_EMAIL === "true";

  const admin = createAdminClient();
  const result = await cancelBookingByToken({ admin, token, forceTestEmail });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true });
}
