import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { awardPriorMonthForAllFieldSpecialists } from "@wayfinder/supabase/staff-badges";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Freeze prior closed-month badges for all active ES/TS (cheap monthly pass). */
export async function GET(request: Request) {
  const route = "api/cron/staff-badges";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await awardPriorMonthForAllFieldSpecialists(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return respondWithCronLoggedError("staff", route, error);
  }
}
