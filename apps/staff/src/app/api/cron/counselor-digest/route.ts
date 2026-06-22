import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { processCounselorWeeklyDigest } from "@wayfinder/supabase/counselor-digest";
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
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const result = await processCounselorWeeklyDigest(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("counselor-digest cron failed:", err);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
