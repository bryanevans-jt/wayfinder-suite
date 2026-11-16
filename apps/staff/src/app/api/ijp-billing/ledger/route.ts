import { loadIjpBillingMonthLedger } from "@wayfinder/supabase/ijp-billing-month-ledger";
import { canGenerateIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { NextRequest, NextResponse } from "next/server";

const PAGE_SIZE_DEFAULT = 25;
const PAGE_SIZE_MAX = 100;

/** Month hours ledger: every IJP-attributed entry + unattributed, paginated by client. */
export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canGenerateIjpBilling(auth.role)) {
    return NextResponse.json({ error: "Ledger access required." }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ error: "month is required." }, { status: 400 });
  }

  const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? "1");
  const pageSizeRaw = Number(
    request.nextUrl.searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT)
  );
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : PAGE_SIZE_DEFAULT)
  );

  const ledger = await loadIjpBillingMonthLedger(auth.admin, month, { isTest: false });
  const totalClients = ledger.clients.length;
  const start = (page - 1) * pageSize;
  const clients = ledger.clients.slice(start, start + pageSize);

  return NextResponse.json({
    month: ledger.month,
    totals: ledger.totals,
    page,
    pageSize,
    totalClients,
    totalPages: Math.max(1, Math.ceil(totalClients / pageSize)),
    clients,
  });
}
