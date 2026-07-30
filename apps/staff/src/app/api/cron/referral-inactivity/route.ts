import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/referral-inactivity";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const cutoffIso = cutoff.toISOString();

    const { data: stale, error } = await admin
      .from("clients")
      .select("id")
      .in("intake_status", ["new_referral", "pending_authorization", "discarded"])
      .lt("last_activity_at", cutoffIso)
      .limit(200);

    if (error) throw new Error(error.message);

    let archived = 0;
    const nowIso = new Date().toISOString();
    for (const row of stale ?? []) {
      const { error: updErr } = await admin
        .from("clients")
        .update({
          intake_status: "discarded",
          intake_status_changed_at: nowIso,
          archived_at: nowIso,
        })
        .eq("id", row.id);
      if (!updErr) {
        await admin.from("client_intake_events").insert({
          client_id: row.id,
          event_type: "inactivity_cleanup",
          to_value: "discarded",
          reason: "12 months of no activity",
        });
        archived += 1;
      }
    }

    return NextResponse.json({ ok: true, archived });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
