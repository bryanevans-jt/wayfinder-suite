import { cleanupExpiredTeamMomentPhotos } from "@/lib/team-moments-cleanup";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const route = "api/cron/team-moments-cleanup";
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
    const result = await cleanupExpiredTeamMomentPhotos(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
