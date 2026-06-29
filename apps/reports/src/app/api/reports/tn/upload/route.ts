import { Readable } from "stream";
import { google } from "googleapis";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDriveDownloadUrl } from "@/lib/drive-file-url";
import { getGoogleAuth, sendEmail } from "@/lib/google";
import { recordFormalSubmission } from "@/lib/record-submission";
import { loadTnReportDefinition } from "@/lib/tn-report-definition";
import { reportApiLoggedError } from "@/lib/api-error";
import { NextResponse } from "next/server";

const FILE_MIME_MAP: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const VALID_EXTENSIONS = Object.keys(FILE_MIME_MAP);

function sanitizeFilePart(value: string): string {
  return value.replace(/[/\\:*?"<>|]/g, "-").trim() || "Unknown";
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reportTypeSlug = new URL(request.url).searchParams.get("reportTypeSlug")?.trim();
    if (!reportTypeSlug) {
      return NextResponse.json({ error: "reportTypeSlug required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const definition = await loadTnReportDefinition(admin, reportTypeSlug);
    if (!definition?.enabled) {
      return NextResponse.json({ error: "Report type is not enabled" }, { status: 404 });
    }
    if (definition.templateKind !== "pdf_upload") {
      return NextResponse.json({ error: "Report type is not a PDF upload form" }, { status: 400 });
    }

    const templateUrl = resolveDriveDownloadUrl(definition.blankPdfFileId);
    return NextResponse.json({
      templateUrl,
      reportName: definition.name,
    });
  } catch (e) {
    console.error("TN upload template fetch error:", e);
    return NextResponse.json({ templateUrl: null });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.email?.endsWith("@thejoshuatree.org")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const reportTypeSlug = (formData.get("reportTypeSlug") as string)?.trim() || "";
    const employmentSpecialistName =
      (formData.get("employmentSpecialistName") as string)?.trim() || "";
    const clientName = (formData.get("clientName") as string)?.trim() || "";
    const wayfinderClientId = (formData.get("wayfinderClientId") as string)?.trim() || "";
    const notes = (formData.get("notes") as string)?.trim() || "";
    const file = formData.get("file") as File | null;

    if (!reportTypeSlug) {
      return NextResponse.json({ error: "reportTypeSlug required" }, { status: 400 });
    }
    if (!clientName) {
      return NextResponse.json({ error: "Customer name required" }, { status: 400 });
    }
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "Please attach the completed document (PDF, Word, or Excel)" },
        { status: 400 }
      );
    }

    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!VALID_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: "File must be PDF, Word (.doc/.docx), or Excel (.xls/.xlsx)" },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const definition = await loadTnReportDefinition(admin, reportTypeSlug);
    if (!definition?.enabled) {
      return NextResponse.json({ error: "Report type is not enabled" }, { status: 404 });
    }
    if (definition.templateKind !== "pdf_upload") {
      return NextResponse.json({ error: "Report type is not a PDF upload form" }, { status: 400 });
    }

    const folderId = definition.driveFolderId;
    if (!folderId) {
      return NextResponse.json(
        { error: "Drive folder must be configured in admin for this report type." },
        { status: 400 }
      );
    }

    const uploadFileName = `${sanitizeFilePart(clientName)} - ${sanitizeFilePart(employmentSpecialistName)} - ${sanitizeFilePart(definition.name)}.${ext}`;

    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const mimeType = FILE_MIME_MAP[ext] || "application/octet-stream";
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploaded = await drive.files.create({
      supportsAllDrives: true,
      requestBody: { name: uploadFileName, parents: [folderId] },
      media: {
        mimeType,
        body: Readable.from(buffer),
      },
      fields: "id",
    });

    const fieldSnapshot: Record<string, unknown> = {
      clientName,
      employmentSpecialistName,
      uploadFileName,
    };
    if (notes) fieldSnapshot.notes = notes;

    await recordFormalSubmission(admin, {
      wayfinderClientId: wayfinderClientId || null,
      clientName,
      state: "TN",
      reportTypeSlug: definition.slug,
      submittedBy: user.id,
      submittedByName: employmentSpecialistName || user.email,
      driveFileId: uploaded.data.id ?? null,
      driveFileName: uploadFileName,
      fieldSnapshot,
    });

    await sendEmail(auth, {
      to: user.email,
      subject: `${definition.name} Submitted - ${clientName}`,
      text: `Hello ${employmentSpecialistName || "there"},\n\nYour completed ${definition.name} for ${clientName} has been submitted successfully. Your attached document is included for your records.\n\nThank you!`,
      attachments: [
        {
          filename: uploadFileName,
          content: buffer.toString("base64"),
          encoding: "base64" as const,
          mimeType,
        },
      ],
    });

    return NextResponse.json({
      success: true,
      message:
        "Report submitted successfully! You will receive a confirmation email with your document attached.",
    });
  } catch (e) {
    return reportApiLoggedError("api/reports/tn/upload", e);
  }
}
