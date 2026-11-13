import { clientDisplayName } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import {
  currentServiceMonthStart,
  filterClientIdsOnGaIjpDuringMonth,
  filterClientIdsWithBillableTime,
  loadBillableTimeEntriesByClient,
  loadGaIjpEligibilitySnapshots,
  serviceMonthEndYmd,
} from "@wayfinder/supabase/ijp-billing-eligibility";
import { resolveGaIjpServiceIds } from "@wayfinder/supabase/ijp-billing-settings";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";
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
    const gaIjpServiceIds = await resolveGaIjpServiceIds(admin);
    if (gaIjpServiceIds.length === 0) {
      return NextResponse.json({ ok: true, skipped: "no_ijp_service", created: 0 });
    }

    const monthStart = currentServiceMonthStart(now);
    const dueAt = new Date(`${serviceMonthEndYmd(monthStart)}T23:59:59-04:00`).toISOString();

    const clients = await fetchAllPostgrestRows<{
      id: string;
      full_name: string | null;
      contact_email: string | null;
      is_demo: boolean | null;
      intake_status: string | null;
    }>(admin, "clients", "id, full_name, contact_email, is_demo, intake_status", {
      order: { column: "id", ascending: true },
      applyFilters: (query) =>
        query.eq("is_demo", false).neq("intake_status", "discarded"),
    });

    const clientIds = clients.map((c) => c.id as string);
    const clientById = new Map(clients.map((c) => [c.id as string, c]));

    const snapshots = await loadGaIjpEligibilitySnapshots(admin, clientIds, gaIjpServiceIds);
    const onIjpIds = filterClientIdsOnGaIjpDuringMonth(snapshots, monthStart, gaIjpServiceIds);
    const billableByClient = await loadBillableTimeEntriesByClient(admin, onIjpIds, monthStart);
    const eligibleIds = filterClientIdsWithBillableTime(billableByClient);

    let created = 0;
    for (const clientId of eligibleIds) {
      const client = clientById.get(clientId);
      if (!client) continue;

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

      const { data: assignment } = await admin
        .from("es_client_assignments")
        .select("es_user_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const label = clientDisplayName(client);
      const { error } = await admin.from("report_dashboard_alerts").insert({
        alert_type: "missing",
        state: "GA",
        report_type_slug: REPORT_TYPE,
        reporting_month: monthStart,
        wayfinder_client_id: clientId,
        client_name: label,
        es_user_id: (assignment?.es_user_id as string) ?? null,
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
