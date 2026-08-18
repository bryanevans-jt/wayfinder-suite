import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import {
  loadPreEtsSessionCompliance,
  loadSupervisorNotifyUserIds,
} from "@wayfinder/supabase/pre-ets-compliance";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/pre-ets-compliance";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    if (!settings.module_enabled) {
      return NextResponse.json({ ok: true, skipped: "module_disabled", notified: 0 });
    }

    const lateSessions = await loadPreEtsSessionCompliance(admin, { onlyLate: true });
    const recipients = await loadSupervisorNotifyUserIds(admin);
    let notified = 0;

    for (const session of lateSessions) {
      const missing: ("late_roster" | "late_car")[] = [];
      if (session.missingRoster) missing.push("late_roster");
      if (session.missingCar) missing.push("late_car");

      for (const kind of missing) {
        for (const userId of recipients) {
          const { error } = await admin.from("pre_ets_compliance_alerts").insert({
            session_id: session.sessionId,
            alert_kind: kind,
            notified_user_id: userId,
          });
          if (error) {
            if (error.code === "23505") continue;
            console.error("pre_ets compliance alert insert:", error.message);
            continue;
          }

          await notifyUser(admin, {
            userId,
            kind: "pre_ets_compliance",
            title: "Pre-ETS documentation overdue",
            body: `${session.schoolName ?? "School"} · Auth ${session.authNumber ?? "—"} · Session ${session.sessionDate ?? "—"} — ${kind === "late_roster" ? "signed roster upload" : "class activity report"} is past due.`,
            href: "/dashboard/pre-ets",
          });
          notified++;
        }
      }
    }

    return NextResponse.json({ ok: true, late: lateSessions.length, notified });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
