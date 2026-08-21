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
import { uploadPreEtsFileToDrivePath } from "@/lib/pre-ets-drive";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/invoice-packets/[id]/archive";
  const auth = await requirePreEtsApi("accounts");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const folderId = auth.settings.drive_invoice_archive_folder_id;
    if (!folderId) {
      return NextResponse.json(
        { error: "Invoice archive Drive folder is not configured in Pre-ETS settings." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      overrides?: InvoicePacketEditableOverrides;
      markReady?: boolean;
    };

    const admin = createServiceRoleClient();
    const loaded = await loadInvoicePacketPdfData(admin, id, auth.settings);
    if (!loaded) {
      return NextResponse.json({ error: "Invoice packet not found" }, { status: 404 });
    }

    const data = applyInvoicePacketOverrides(loaded, body.overrides);
    if (!data.accountsSignatureData?.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Accounts Specialist signature is required before archiving." },
        { status: 400 }
      );
    }
    if (!data.accountsSignedDate) {
      return NextResponse.json(
        { error: "Accounts signed date is required before archiving." },
        { status: 400 }
      );
    }

    const exported = await buildInvoicePacketExport(data, auth.settings, admin);
    const fileName = exported.fileName;

    const uploaded = await uploadPreEtsFileToDrivePath({
      rootFolderId: folderId,
      pathTemplate: auth.settings.drive_folder_path_template,
      pathVars: {
        schoolYear: auth.settings.school_year,
        district: data.districtFolderName,
        month: data.serviceMonth,
        school: data.schoolName,
        authNumber: data.authNumber || "unknown",
      },
      fileName,
      mimeType: exported.contentType,
      buffer: Buffer.from(exported.buffer),
    });

    const patch: Record<string, unknown> = {
      drive_file_id: uploaded.fileId,
      drive_file_name: uploaded.fileName,
      generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (body.markReady) {
      patch.status = "ready";
    }
    if (data.invoiceNumber !== undefined) {
      patch.provider_invoice_number = data.invoiceNumber;
    }
    if (Number.isFinite(data.totalUnits)) {
      patch.total_hours = data.totalUnits;
    }
    if (Number.isFinite(data.totalAmountCents)) {
      patch.total_amount_cents = data.totalAmountCents;
    }

    await admin.from("pre_ets_invoice_packets").update(patch).eq("id", id);

    await insertInvoicePacketEvent(admin, {
      packetId: id,
      actorUserId: auth.userId,
      eventKind: "drive_archived",
      metadata: {
        driveFileId: uploaded.fileId,
        fileName: uploaded.fileName,
        exportKind: exported.exportKind,
        exportMode: auth.settings.invoice_export_mode,
        reviewed: true,
        markReady: Boolean(body.markReady),
      },
    });

    return NextResponse.json({
      ok: true,
      driveFileId: uploaded.fileId,
      driveUrl: uploaded.webViewLink,
      fileName: uploaded.fileName,
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
