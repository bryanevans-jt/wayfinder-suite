import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { runDailyEmploymentCelebrations } from "@wayfinder/supabase/employment-celebrations";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/cron/employment-celebrations";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }

  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  if (auth !== `Bearer ${secret}` && querySecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await runDailyEmploymentCelebrations(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
