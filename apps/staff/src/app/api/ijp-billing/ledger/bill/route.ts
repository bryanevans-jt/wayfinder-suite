import { canGenerateIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { billIjpLedgerEntries } from "@/lib/ijp-billing-ledger-actions";
import { NextRequest, NextResponse } from "next/server";

/** Bill selected entries, or all unbilled for given clients / whole month scope. */
export async function POST(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canGenerateIjpBilling(auth.role)) {
    return NextResponse.json({ error: "Generate access required." }, { status: 403 });
  }

  const body = (await request.json()) as {
    serviceMonth?: string;
    entryIds?: string[];
    clientIds?: string[];
    billAllUnbilled?: boolean;
  };

  const serviceMonth = body.serviceMonth?.trim();
  if (!serviceMonth) {
    return NextResponse.json({ error: "serviceMonth is required." }, { status: 400 });
  }

  let clientIds = Array.isArray(body.clientIds) ? body.clientIds.filter(Boolean) : [];
  const entryIds = Array.isArray(body.entryIds) ? body.entryIds.filter(Boolean) : [];

  if (body.billAllUnbilled === true && clientIds.length === 0 && entryIds.length === 0) {
    const { loadIjpBillingMonthLedger } = await import(
      "@wayfinder/supabase/ijp-billing-month-ledger"
    );
    const ledger = await loadIjpBillingMonthLedger(auth.admin, serviceMonth, {
      isTest: false,
    });
    clientIds = ledger.clients
      .filter((c) => c.entries.some((e) => !e.billed))
      .map((c) => c.clientId);
  }

  const { data: profile } = await auth.admin
    .from("profiles")
    .select("full_name")
    .eq("id", auth.userId)
    .maybeSingle();

  const result = await billIjpLedgerEntries(auth.admin, {
    entryIds: entryIds.length > 0 ? entryIds : undefined,
    clientIds: clientIds.length > 0 ? clientIds : undefined,
    serviceMonth,
    settings: auth.settings,
    actorUserId: auth.userId,
    actorName: (profile?.full_name as string | null) ?? null,
    isTest: false,
  });

  return NextResponse.json(result);
}
