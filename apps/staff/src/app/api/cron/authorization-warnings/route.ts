import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { runAuthorizationWarningsScan } from "@wayfinder/supabase/authorization-warnings";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Daily soft authorization-warning notifications for assigned ES/TS (no action blocking). */
export async function GET(request: Request) {
  const route = "api/cron/authorization-warnings";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await runAuthorizationWarningsScan(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return respondWithCronLoggedError("staff", route, error);
  }
}
