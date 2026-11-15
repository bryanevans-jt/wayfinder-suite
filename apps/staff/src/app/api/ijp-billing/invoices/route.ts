import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { loadIjpBillingMonthClientRoster } from "@wayfinder/supabase/ijp-billing-month-roster";
import { canEditIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { USER_FACING_FORBIDDEN } from "@wayfinder/supabase/error-log";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { ensureIjpInvoiceRow } from "@/lib/ijp-billing-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Month roster: every client with IJP activity in the month (and any existing
 * invoices), one row per client, sorted by last name. Does not require Generate.
 */
export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  const month =
    request.nextUrl.searchParams.get("month")?.trim() || priorServiceMonthStart();
  const isTest = request.nextUrl.searchParams.get("test") === "1";

  try {
    const roster = await loadIjpBillingMonthClientRoster(auth.admin, month, {
      isTest,
    });

    // Flat invoice list kept for older callers / ZIP helpers that still expect it.
    const invoices = roster.clients.flatMap((client) =>
      client.invoices.map((inv) => ({
        ...inv,
        client_id: client.clientId,
        clientName: client.clientName,
        is_test: isTest,
        service_month: roster.month,
      }))
    );

    return NextResponse.json({
      month: roster.month,
      isTest,
      clients: roster.clients,
      invoices,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not load IJP billing month." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  if (!canEditIjpBilling(auth.role)) {
    return NextResponse.json({ error: USER_FACING_FORBIDDEN }, { status: 403 });
  }

  const body = (await request.json()) as {
    clientId?: string;
    serviceMonth?: string;
    isTest?: boolean;
    refreshLines?: boolean;
  };
  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required." }, { status: 400 });
  }
  const serviceMonth = body.serviceMonth?.trim() || priorServiceMonthStart();
  const isTest = Boolean(body.isTest);

  try {
    const row = await ensureIjpInvoiceRow(auth.admin, {
      clientId,
      serviceMonth,
      isTest,
      settings: auth.settings,
      forceRefresh: Boolean(body.refreshLines),
    });
    if (row.empty || !row.id) {
      return NextResponse.json(
        { error: "No billable Individual Job Placement hours to invoice for this client." },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, invoiceId: row.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create invoice." },
      { status: 400 }
    );
  }
}
