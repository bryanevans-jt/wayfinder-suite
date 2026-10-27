import { clientDisplayName } from "@wayfinder/branding";
import { priorServiceMonthStart } from "@wayfinder/supabase/ijp-billing-eligibility";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { ensureIjpInvoiceRow } from "@/lib/ijp-billing-service";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  const month =
    request.nextUrl.searchParams.get("month")?.trim() || priorServiceMonthStart();
  const isTest = request.nextUrl.searchParams.get("test") === "1";

  const { data: rows, error } = await auth.admin
    .from("ijp_billing_invoices")
    .select(
      "id, client_id, service_month, status, provider_invoice_number, authorization_number, invoice_date, total_hours, total_amount_cents, missing_attestation, is_test, compiled_at, archived_at"
    )
    .eq("service_month", month)
    .eq("is_test", isTest)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const clientIds = [...new Set((rows ?? []).map((r) => r.client_id as string))];
  const { data: clients } = await auth.admin
    .from("clients")
    .select("id, full_name, contact_email")
    .in("id", clientIds.length ? clientIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map(
    (clients ?? []).map((c) => [c.id as string, clientDisplayName(c)])
  );

  const attestations = await auth.admin
    .from("ijp_monthly_attestations")
    .select("client_id, attestation_drive_file_id")
    .eq("service_month", month)
    .eq("is_test", isTest);
  const hasAtt = new Set(
    (attestations.data ?? [])
      .filter((a) => a.attestation_drive_file_id)
      .map((a) => a.client_id as string)
  );

  return NextResponse.json({
    month,
    isTest,
    invoices: (rows ?? []).map((r) => ({
      ...r,
      clientName: nameById.get(r.client_id as string) ?? "Client",
      hasAttestation: hasAtt.has(r.client_id as string),
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

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
    return NextResponse.json({ ok: true, invoiceId: row.id });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create invoice." },
      { status: 400 }
    );
  }
}
