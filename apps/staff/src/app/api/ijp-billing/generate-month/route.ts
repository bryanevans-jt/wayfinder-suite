import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { loadEligibleIjpClientIdsForMonth } from "@wayfinder/supabase/ijp-billing-eligibility";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { ensureIjpInvoiceRow, compileIjpInvoicePdf } from "@/lib/ijp-billing-service";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  await assertNotPreviewMutation();
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (auth.role !== "super_admin" && auth.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = (await request.json()) as { serviceMonth?: string; compile?: boolean };
  const serviceMonth = body.serviceMonth?.trim();
  if (!serviceMonth) {
    return NextResponse.json({ error: "serviceMonth is required." }, { status: 400 });
  }

  if (!auth.settings.module_enabled) {
    return NextResponse.json({ error: "IJP billing module is disabled." }, { status: 400 });
  }

  const clientIds = await loadEligibleIjpClientIdsForMonth(auth.admin, serviceMonth);
  let rows = 0;
  let compiled = 0;
  const shouldCompile = body.compile !== false;

  for (const clientId of clientIds) {
    const row = await ensureIjpInvoiceRow(auth.admin, {
      clientId,
      serviceMonth,
      isTest: false,
      settings: auth.settings,
    });
    rows += 1;

    const { data: att } = await auth.admin
      .from("ijp_monthly_attestations")
      .select("attestation_drive_file_id")
      .eq("client_id", clientId)
      .eq("service_month", serviceMonth)
      .eq("is_test", false)
      .maybeSingle();

    await auth.admin
      .from("ijp_billing_invoices")
      .update({
        missing_attestation: !att?.attestation_drive_file_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (shouldCompile) {
      try {
        await compileIjpInvoicePdf(auth.admin, row.id, auth.settings);
        compiled += 1;
      } catch (e) {
        console.error("ijp manual compile failed:", clientId, e);
      }
    }
  }

  return NextResponse.json({ ok: true, serviceMonth, rows, compiled, total: clientIds.length });
}
