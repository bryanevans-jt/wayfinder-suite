import { loadIjpBillingMonthCompleteness } from "@wayfinder/supabase/ijp-billing-eligibility";
import { canGenerateIjpBilling } from "@wayfinder/supabase/ijp-billing-settings";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { NextRequest, NextResponse } from "next/server";

/** Completeness for Accounts Specialist / Admin: unbilled hours vs invoices for the month. */
export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  if (!canGenerateIjpBilling(auth.role)) {
    return NextResponse.json({ error: "Generate access required." }, { status: 403 });
  }

  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ error: "month is required." }, { status: 400 });
  }

  const completeness = await loadIjpBillingMonthCompleteness(auth.admin, month, {
    isTest: false,
  });

  let missingClients: Array<{ id: string; name: string }> = [];
  if (completeness.missingClientIds.length > 0) {
    const { data } = await auth.admin
      .from("clients")
      .select("id, full_name, contact_email")
      .in("id", completeness.missingClientIds.slice(0, 200));
    const nameById = new Map(
      (data ?? []).map((row) => [
        row.id as string,
        ((row.full_name as string) || (row.contact_email as string) || "Client").trim(),
      ])
    );
    missingClients = completeness.missingClientIds.map((id) => ({
      id,
      name: nameById.get(id) ?? id,
    }));
  }

  return NextResponse.json({
    ...completeness,
    missingClients,
  });
}
