import { Readable } from "stream";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getGoogleAuth, sendEmail } from "@/lib/google";
import { generateTnGoogleDocPdf } from "@/lib/pdf-generator";
import { recordFormalSubmission } from "@/lib/record-submission";
import { resolveTnClientName } from "@/lib/tn-prefill";
import { loadTnReportDefinition } from "@/lib/tn-report-definition";
import { reportApiLoggedError } from "@/lib/api-error";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { reportTypeSlug, reportData, typedEsName, signatureData, wayfinderClientId } = body as {
      reportTypeSlug?: string;
      reportData?: Record<string, unknown>;
      typedEsName?: string;
      signatureData?: string;
      wayfinderClientId?: string | null;
    };

    if (!reportTypeSlug?.trim()) {
      return NextResponse.json({ error: "reportTypeSlug required" }, { status: 400 });
    }
    if (!reportData || typeof reportData !== "object") {
      return NextResponse.json({ error: "reportData required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const definition = await loadTnReportDefinition(admin, reportTypeSlug);
    if (!definition?.enabled) {
      return NextResponse.json({ error: "Report type is not enabled" }, { status: 404 });
    }
    if (definition.templateKind !== "google_doc") {
      return NextResponse.json(
        { error: "Only google_doc Tennessee reports are supported in this flow" },
        { status: 400 }
      );
    }

    const templateId = definition.googleDocTemplateId;
    const folderId = definition.driveFolderId;
    if (!templateId || !folderId) {
      return NextResponse.json(
        { error: "Template ID and Drive folder must be configured in admin for this report type." },
        { status: 400 }
      );
    }

    const requiresSignature = definition.requiresSignature;
    if (requiresSignature && !signatureData) {
      return NextResponse.json({ error: "Signature is required for this report type." }, { status: 400 });
    }

    const { data: adminConfig } = await admin
      .from("admin_config")
      .select("drive_folders")
      .limit(1)
      .maybeSingle();
    const folders = (adminConfig?.drive_folders as Record<string, string>) || {};
    const sigFolderId = folders.signature_temp || folderId;

    const auth = await getGoogleAuth();
    const pdfBytes = await generateTnGoogleDocPdf(auth, reportData, {
      templateId,
      typedEsName: typedEsName || "",
      signatureData: signatureData || "",
      signatureFolderId: sigFolderId,
      embedSignature: requiresSignature,
    });

    const drive = (await import("googleapis")).google.drive({ version: "v3", auth });
    const customerName = resolveTnClientName(reportData);
    const fileName = `${customerName} - ${definition.name}.pdf`;
    const uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: fileName, parents: [folderId] },
      media: {
        mimeType: "application/pdf",
        body: Readable.from(pdfBytes),
      },
      fields: "id",
    });

    const driveFileId = uploaded.data.id ?? null;
    const submitterName = typedEsName || user.email || "";

    await recordFormalSubmission(admin, {
      wayfinderClientId: wayfinderClientId || null,
      clientName: customerName,
      state: "TN",
      reportTypeSlug: definition.slug,
      submittedBy: user.id,
      submittedByName: submitterName,
      driveFileId,
      driveFileName: fileName,
      fieldSnapshot: reportData,
    });

    await sendEmail(auth, {
      to: user.email,
      subject: `Completed ${definition.name} for ${customerName}`,
      text: `Hello,\n\nYour completed Tennessee report for ${customerName} is attached.\n\nThank you!`,
      attachments: [{ filename: fileName, content: pdfBytes.toString("base64"), encoding: "base64" }],
    });

    return NextResponse.json({ success: true, driveFileId });
  } catch (e) {
    return reportApiLoggedError("api/reports/tn", e);
  }
}
