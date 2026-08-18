import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  insertInvoicePacketEvent,
  loadInvoicePacketPdfData,
} from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { generatePreEtsInvoicePacketPdf } from "@/lib/pre-ets-invoice-pdf";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/invoice-packets/[id]/pdf";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const data = await loadInvoicePacketPdfData(admin, id, auth.settings);
    if (!data) {
      return NextResponse.json({ error: "Invoice packet not found" }, { status: 404 });
    }

    const pdfBytes = await generatePreEtsInvoicePacketPdf(data);

    await insertInvoicePacketEvent(admin, {
      packetId: id,
      actorUserId: auth.userId,
      eventKind: "pdf_generated",
      metadata: { totalUnits: data.totalUnits },
    });

    await admin
      .from("pre_ets_invoice_packets")
      .update({ generated_at: new Date().toISOString() })
      .eq("id", id);

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-ets-invoice-${data.authNumber || id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
