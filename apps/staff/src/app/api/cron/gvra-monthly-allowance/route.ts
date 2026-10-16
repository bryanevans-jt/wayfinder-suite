import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { grantGvraMonthlyAllowancesForPriorMonth } from "@wayfinder/supabase/gvra-monthly-allowance";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/gvra-monthly-allowance";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await grantGvraMonthlyAllowancesForPriorMonth(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return respondWithCronLoggedError("staff", route, error);
  }
}
