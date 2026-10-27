import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { compileIjpInvoicePdf } from "@/lib/ijp-billing-service";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  try {
    const result = await compileIjpInvoicePdf(auth.admin, id, auth.settings);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Compile failed." },
      { status: 400 }
    );
  }
}
