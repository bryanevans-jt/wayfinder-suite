import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { processDueIntakeAppointmentReminders } from "@wayfinder/supabase/intake-appointment-reminders";
import { deliverIntakeAppointmentReminder } from "@/lib/intake-appointment-email";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/intake-appointment-reminders";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await processDueIntakeAppointmentReminders(
      admin,
      deliverIntakeAppointmentReminder
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return respondWithCronLoggedError("staff", route, error);
  }
}
