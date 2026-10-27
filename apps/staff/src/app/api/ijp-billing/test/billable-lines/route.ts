import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { syncIjpInvoiceLineItemsFromBillable } from "@/lib/ijp-billing-service";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!isAdminTierRole(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const clientId = request.nextUrl.searchParams.get("clientId")?.trim();
  const serviceMonth = request.nextUrl.searchParams.get("serviceMonth")?.trim();
  if (!clientId || !serviceMonth) {
    return NextResponse.json(
      { error: "clientId and serviceMonth are required." },
      { status: 400 }
    );
  }

  try {
    const synced = await syncIjpInvoiceLineItemsFromBillable(auth.admin, {
      clientId,
      serviceMonth,
      isTest: true,
      settings: auth.settings,
    });
    return NextResponse.json({
      ok: true,
      invoiceId: synced.id,
      lineItems: synced.line_items,
      totalHours: synced.total_hours,
      totalAmountCents: synced.total_amount_cents,
      approvedEntryCount: synced.approvedEntryCount,
      billableEntryCount: synced.billableEntryCount,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load billable lines." },
      { status: 400 }
    );
  }
}
