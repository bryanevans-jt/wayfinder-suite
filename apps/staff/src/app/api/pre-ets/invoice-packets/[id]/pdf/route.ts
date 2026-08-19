import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  insertInvoicePacketEvent,
  loadInvoicePacketPdfData,
} from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { buildInvoicePacketExport } from "@/lib/pre-ets-invoice-export";
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

    const exported = await buildInvoicePacketExport(data, auth.settings);

    await insertInvoicePacketEvent(admin, {
      packetId: id,
      actorUserId: auth.userId,
      eventKind: "pdf_generated",
      metadata: {
        totalUnits: data.totalUnits,
        exportKind: exported.exportKind,
        exportMode: auth.settings.invoice_export_mode,
      },
    });

    await admin
      .from("pre_ets_invoice_packets")
      .update({ generated_at: new Date().toISOString() })
      .eq("id", id);

    return new NextResponse(Buffer.from(exported.buffer), {
      headers: {
        "Content-Type": exported.contentType,
        "Content-Disposition": `attachment; filename="${exported.fileName}"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
