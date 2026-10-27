import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithCronLoggedError } from "@wayfinder/supabase/error-log";
import { loadEligibleIjpClientIdsForMonth, priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { loadIjpBillingSettings } from "@wayfinder/supabase/ijp-billing-settings";
import { ensureIjpInvoiceRow, compileIjpInvoicePdf } from "@/lib/ijp-billing-service";
import { NextResponse } from "next/server";

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  const route = "api/cron/ijp-invoice-generation";
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createServiceRoleClient();
    const settings = await loadIjpBillingSettings(admin);
    if (!settings.module_enabled) {
      return NextResponse.json({ ok: true, skipped: "module_disabled" });
    }

    const serviceMonth = priorServiceMonthStart();
    const clientIds = await loadEligibleIjpClientIdsForMonth(admin, serviceMonth);

    let rows = 0;
    let compiled = 0;
    const batchSize = 5;

    for (let i = 0; i < clientIds.length; i += batchSize) {
      const batch = clientIds.slice(i, i + batchSize);
      for (const clientId of batch) {
        const row = await ensureIjpInvoiceRow(admin, {
          clientId,
          serviceMonth,
          isTest: false,
          settings,
        });
        rows += 1;

        const { data: att } = await admin
          .from("ijp_monthly_attestations")
          .select("attestation_drive_file_id")
          .eq("client_id", clientId)
          .eq("service_month", serviceMonth)
          .eq("is_test", false)
          .maybeSingle();

        await admin
          .from("ijp_billing_invoices")
          .update({
            missing_attestation: !att?.attestation_drive_file_id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        try {
          await compileIjpInvoicePdf(admin, row.id, settings);
          compiled += 1;
        } catch (e) {
          console.error("ijp invoice compile failed:", clientId, e);
        }
      }
    }

    return NextResponse.json({ ok: true, serviceMonth, rows, compiled, total: clientIds.length });
  } catch (err) {
    return respondWithCronLoggedError("staff", route, err);
  }
}
