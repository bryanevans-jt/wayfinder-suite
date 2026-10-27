import { requireIjpBillingApi } from "@/lib/ijp-billing-access";
import { buildIjpInvoiceDownloadPdf } from "@/lib/ijp-billing-download";
import { NextResponse } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Ctx) {
  const auth = await requireIjpBillingApi();
  if ("error" in auth) return auth.error;
  const { id } = await ctx.params;

  try {
    const { buffer, fileName, missingAttestation } = await buildIjpInvoiceDownloadPdf(
      auth.admin,
      id,
      auth.settings
    );
    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "")}"`,
        "X-Ijp-Missing-Attestation": missingAttestation ? "1" : "0",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Download failed." },
      { status: 400 }
    );
  }
}
