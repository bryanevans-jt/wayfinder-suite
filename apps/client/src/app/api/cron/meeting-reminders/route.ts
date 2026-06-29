import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { processDueMeetingReminders } from "@wayfinder/supabase/meeting-reminders";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/meeting-reminders";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await processDueMeetingReminders(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return respondWithCronLoggedError("client", route, err);
  }
}
