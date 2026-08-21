import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import {
  insertInvoicePacketEvent,
  loadInvoicePacketPdfData,
} from "@wayfinder/supabase/pre-ets-invoice-packet";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { buildInvoicePacketExport } from "@/lib/pre-ets-invoice-export";
import { uploadPreEtsFileToDrivePath } from "@/lib/pre-ets-drive";
import { NextResponse } from "next/server";

export async function POST(
  _request: Request,
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

    const admin = createServiceRoleClient();
    const data = await loadInvoicePacketPdfData(admin, id, auth.settings);
    if (!data) {
      return NextResponse.json({ error: "Invoice packet not found" }, { status: 404 });
    }

    const exported = await buildInvoicePacketExport(data, auth.settings);
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

    await admin
      .from("pre_ets_invoice_packets")
      .update({
        drive_file_id: uploaded.fileId,
        drive_file_name: uploaded.fileName,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    await insertInvoicePacketEvent(admin, {
      packetId: id,
      actorUserId: auth.userId,
      eventKind: "drive_archived",
      metadata: {
        driveFileId: uploaded.fileId,
        fileName: uploaded.fileName,
        exportKind: exported.exportKind,
        exportMode: auth.settings.invoice_export_mode,
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
