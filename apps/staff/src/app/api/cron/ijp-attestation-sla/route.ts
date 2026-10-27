import { clientDisplayName } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import {
  clientHasBillableTimeInMonth,
  clientOnGaIjpDuringMonth,
  currentServiceMonthStart,
  serviceMonthEndYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { resolveGaIjpServiceId } from "@wayfinder/supabase/ijp-billing-settings";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "@wayfinder/supabase/staff-time-clock-shared";
import { NextResponse } from "next/server";

const REPORT_TYPE = "ijp_attestation";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/ijp-attestation-sla";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const ymd = localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
    const day = Number(ymd.split("-")[2]);
    if (day !== 25) {
      return NextResponse.json({ ok: true, skipped: "not_25th", created: 0 });
    }

    const admin = createServiceRoleClient();
    const gaIjpServiceId = await resolveGaIjpServiceId(admin);
    if (!gaIjpServiceId) {
      return NextResponse.json({ ok: true, skipped: "no_ijp_service", created: 0 });
    }

    const monthStart = currentServiceMonthStart(now);
    const dueAt = new Date(`${serviceMonthEndYmd(monthStart)}T23:59:59-04:00`).toISOString();

    const { data: clients } = await admin
      .from("clients")
      .select("id, full_name, contact_email, es_user_id, is_demo, intake_status")
      .eq("is_demo", false)
      .neq("intake_status", "discarded");

    let created = 0;
    for (const client of clients ?? []) {
      const clientId = client.id as string;
      if (!(await clientOnGaIjpDuringMonth(admin, clientId, monthStart, gaIjpServiceId))) continue;
      if (!(await clientHasBillableTimeInMonth(admin, clientId, monthStart))) continue;

      const { data: att } = await admin
        .from("ijp_monthly_attestations")
        .select("id")
        .eq("client_id", clientId)
        .eq("service_month", monthStart)
        .eq("is_test", false)
        .not("attestation_drive_file_id", "is", null)
        .maybeSingle();
      if (att?.id) continue;

      const { data: dismissed } = await admin
        .from("ijp_attestation_sla_dismissals")
        .select("id")
        .eq("client_id", clientId)
        .eq("service_month", monthStart)
        .maybeSingle();
      if (dismissed?.id) continue;

      const label = clientDisplayName(client);
      const { error } = await admin.from("report_dashboard_alerts").insert({
        alert_type: "missing",
        state: "GA",
        report_type_slug: REPORT_TYPE,
        reporting_month: monthStart,
        wayfinder_client_id: clientId,
        client_name: label,
        es_user_id: (client.es_user_id as string) ?? null,
        due_at: dueAt,
      });

      if (error) {
        if (error.code === "23505") continue;
        console.error("ijp attestation alert insert:", error.message);
        continue;
      }
      created += 1;
    }

    return NextResponse.json({ ok: true, created, monthStart });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
