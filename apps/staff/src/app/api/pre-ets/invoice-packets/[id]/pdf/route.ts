import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  applyInvoicePacketOverrides,
  insertInvoicePacketEvent,
  loadInvoicePacketPdfData,
  type InvoicePacketEditableOverrides,
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

    const exported = await buildInvoicePacketExport(data, auth.settings, admin);

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

/** Generate PDF with Accounts review overrides + signature. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/invoice-packets/[id]/pdf";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      overrides?: InvoicePacketEditableOverrides;
    };

    const admin = createServiceRoleClient();
    const loaded = await loadInvoicePacketPdfData(admin, id, auth.settings);
    if (!loaded) {
      return NextResponse.json({ error: "Invoice packet not found" }, { status: 404 });
    }

    const data = applyInvoicePacketOverrides(loaded, body.overrides);
    if (!data.accountsSignatureData?.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Accounts Specialist signature is required before generating the packet." },
        { status: 400 }
      );
    }
    if (!data.accountsSignedDate) {
      return NextResponse.json(
        { error: "Accounts signed date is required before generating the packet." },
        { status: 400 }
      );
    }

    const exported = await buildInvoicePacketExport(data, auth.settings, admin);

    await insertInvoicePacketEvent(admin, {
      packetId: id,
      actorUserId: auth.userId,
      eventKind: "pdf_generated",
      metadata: {
        totalUnits: data.totalUnits,
        exportKind: exported.exportKind,
        exportMode: auth.settings.invoice_export_mode,
        reviewed: true,
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
