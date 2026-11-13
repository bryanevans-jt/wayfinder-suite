import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { canEditIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_FORBIDDEN } from "@wayfinder/supabase/error-log";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { refreshDraftIjpInvoiceLinesForMonth } from "@/lib/ijp-billing-service";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * One batched refresh for the viewed service month: rebuilds draft /
 * non-compiled / non-archived invoice lines from billable ES time.
 * Skips invoices with manuallyAdjusted line items.
 */
export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  if (!canEditIjpBilling(auth.role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    serviceMonth?: string;
    isTest?: boolean;
  };
  const serviceMonth = body.serviceMonth?.trim() || priorServiceMonthStart();
  const isTest = Boolean(body.isTest);

  try {
    const result = await refreshDraftIjpInvoiceLinesForMonth(auth.admin, {
      serviceMonth,
      isTest,
      settings: auth.settings,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not refresh invoice lines." },
      { status: 400 }
    );
  }
}
