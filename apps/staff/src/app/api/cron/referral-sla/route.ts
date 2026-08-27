import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import {
  isEasternWeekday,
  isGaTseService,
  isPhase1IntakeStage,
  loadHrIntakeRecipientUserIds,
} from "@wayfinder/supabase/referral-intake";
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
  const route = "api/cron/referral-sla";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (!isEasternWeekday()) {
      return NextResponse.json({ ok: true, skipped: "weekend", reminded: 0 });
    }

    const admin = createServiceRoleClient();
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: stuck } = await admin
      .from("clients")
      .select("id, full_name, contact_email, intake_status, intake_status_changed_at, current_service_id, current_stage_id")
      .in("intake_status", ["new_referral", "pending_authorization", "active"])
      .lt("intake_status_changed_at", cutoff)
      .limit(200);

    const recipients = await loadHrIntakeRecipientUserIds(admin);
    let reminded = 0;

    for (const client of stuck ?? []) {
      const status = client.intake_status as string;
      let include = status === "new_referral" || status === "pending_authorization";
      if (status === "active") {
        const ga = await isGaTseService(admin, client.current_service_id as string);
        const p1 = await isPhase1IntakeStage(admin, client.current_stage_id as string);
        include = ga && p1;
      }
      if (!include) continue;

      const label =
        (client.full_name as string)?.trim() ||
        (client.contact_email as string)?.trim() ||
        (client.id as string);

      let body = "Follow up on this referral.";
      if (status === "new_referral") body = "Still New Referral after 7+ days — review and advance.";
      if (status === "pending_authorization") {
        body = "Pending Authorization for 7+ days — recheck the state agency portal.";
      }
      if (status === "active") {
        body = "GA TSE Phase 1 (Needs Intake) for 7+ days — confirm intake is scheduled.";
      }

      for (const userId of recipients) {
        await notifyUser(admin, {
          userId,
          app: "staff",
          kind: "referral_sla",
          title: `Referral follow-up: ${label}`,
          body,
          link_path: `/dashboard/referrals/${client.id as string}`,
          metadata: { clientId: client.id, intake_status: status },
        });
      }
      reminded += 1;
    }

    return NextResponse.json({ ok: true, reminded });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
