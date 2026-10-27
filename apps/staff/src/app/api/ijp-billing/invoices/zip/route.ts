import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { buildIjpInvoicesZip } from "@/lib/ijp-billing-download";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;

  const month = request.nextUrl.searchParams.get("month")?.trim();
  if (!month) {
    return NextResponse.json({ error: "month query param is required (YYYY-MM-01)." }, { status: 400 });
  }

  const { data: rows, error } = await auth.admin
    .from("ijp_billing_invoices")
    .select("id")
    .eq("service_month", month)
    .eq("is_test", false);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (rows ?? []).map((r) => r.id as string);
  if (ids.length === 0) {
    return NextResponse.json({ error: "No invoices for this month." }, { status: 404 });
  }

  try {
    const { buffer } = await buildIjpInvoicesZip(auth.admin, ids, auth.settings);
    const monthKey = month.slice(0, 7);
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ijp-invoices-${monthKey}.zip"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "ZIP failed." },
      { status: 400 }
    );
  }
}
