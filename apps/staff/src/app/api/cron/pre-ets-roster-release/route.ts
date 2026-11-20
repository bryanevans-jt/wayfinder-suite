import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import {
  markPreEtsBatchNotifySent,
  runPreEtsTwentiethBatchRelease,
} from "@wayfinder/supabase/pre-ets-field-release";
import { easternCalendarParts } from "@wayfinder/supabase/pre-ets-release";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { deliverPreEtsBatchRosterReleaseNotices } from "@/lib/pre-ets-roster-batch-email";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Run near 9am Eastern on the 20th (vercel cron fires a few UTC hours around that window). */
function isPreEtsRosterReleaseEasternWindow(now = new Date()): boolean {
  const parts = easternCalendarParts(now);
  return parts.day === 20 && parts.hour >= 8 && parts.hour <= 11;
}

export async function GET(request: Request) {
  const route = "api/cron/pre-ets-roster-release";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const force = new URL(request.url).searchParams.get("force") === "1";
  if (!force && !isPreEtsRosterReleaseEasternWindow()) {
    return NextResponse.json({
      ok: true,
      skipped: "outside_eastern_20th_window",
    });
  }

  try {
    const admin = createServiceRoleClient();
    const settings = await loadPreEtsSettings(admin);
    if (!settings.module_enabled) {
      return NextResponse.json({ ok: true, skipped: "module_disabled" });
    }

    const batch = await runPreEtsTwentiethBatchRelease(admin);
    let notified = 0;
    let emailed = 0;

    if (
      !batch.skippedBlocked &&
      !batch.skippedAlreadyNotified &&
      !batch.missingUploadAlerted &&
      batch.recipientSchoolLabels.size > 0
    ) {
      const delivered = await deliverPreEtsBatchRosterReleaseNotices(admin, {
        serviceMonth: batch.serviceMonth,
        recipientSchoolLabels: batch.recipientSchoolLabels,
      });
      notified = delivered.notified;
      emailed = delivered.emailed;
      await markPreEtsBatchNotifySent(admin, batch.serviceMonth);
    }

    return NextResponse.json({
      ok: true,
      serviceMonth: batch.serviceMonth,
      releasedCount: batch.releasedIds.length,
      schoolCount: batch.schoolLabels.length,
      missingUploadAlerted: batch.missingUploadAlerted,
      skippedBlocked: batch.skippedBlocked,
      skippedAlreadyNotified: batch.skippedAlreadyNotified,
      notified,
      emailed,
    });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
