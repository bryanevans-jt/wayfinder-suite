import { recalcLineAmount, sumIjpLineItems, type IjpInvoiceLineItem } from "@wayfinder/supabase/ijp-billing-lines";
import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  const { data, error } = await auth.admin.from("ijp_billing_invoices").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json({ invoice: data });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;
  const body = (await request.json()) as {
    provider_invoice_number?: string;
    authorization_number?: string;
    invoice_date?: string;
    status?: string;
    line_items?: IjpInvoiceLineItem[];
  };

  const { data: existing } = await auth.admin
    .from("ijp_billing_invoices")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  let lines = (body.line_items ?? (existing.line_items as IjpInvoiceLineItem[]) ?? []) as IjpInvoiceLineItem[];
  lines = lines.map((line) => recalcLineAmount(line, auth.settings.hourly_rate_cents));
  const totals = sumIjpLineItems(lines);

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    line_items: lines,
    total_hours: totals.totalHours,
    total_amount_cents: totals.totalAmountCents,
  };
  if (body.provider_invoice_number !== undefined) {
    patch.provider_invoice_number = body.provider_invoice_number.trim() || null;
  }
  if (body.authorization_number !== undefined) {
    patch.authorization_number = body.authorization_number.trim() || null;
  }
  if (body.invoice_date !== undefined) patch.invoice_date = body.invoice_date || null;
  if (body.status !== undefined) patch.status = body.status;

  const { data, error } = await auth.admin
    .from("ijp_billing_invoices")
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ invoice: data });
}
