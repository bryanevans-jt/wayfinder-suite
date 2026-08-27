import { Readable } from "stream";
import { google } from "googleapis";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { driveFileUrl } from "@/lib/formal-report-utils";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { renderTemplatedFlatEmail } from "@wayfinder/supabase/render-templated-email";

export { isVprServiceStage, resolveReportingState } from "@/lib/vpr-stages";

export async function generateVprPdf(
  auth: Awaited<ReturnType<typeof getGoogleAuth>>,
  parsedData: Record<string, string>,
  config: { templateId: string; folderId: string }
): Promise<Buffer> {
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });
  const copy = await drive.files.copy({
    supportsAllDrives: true,
    fileId: config.templateId,
    requestBody: { name: `[TEMP] VPR - ${parsedData.ClientName || "Report"}` },
  });
  const tempDocId = copy.data.id;
  if (!tempDocId) {
    throw new Error("Could not copy the Vocational Progress Report template.");
  }
  try {
    const requests = Object.entries(parsedData).map(([k, v]) => ({
      replaceAllText: {
        containsText: { text: `{{${k}}}` },
        replaceText: String(v ?? ""),
      },
    }));
    await docs.documents.batchUpdate({ documentId: tempDocId, requestBody: { requests } });
    const pdfRes = await drive.files.export(
      { supportsAllDrives: true, fileId: tempDocId, mimeType: "application/pdf" } as {
        fileId: string;
        mimeType: string;
      },
      { responseType: "arraybuffer" }
    );
    return Buffer.from(pdfRes.data as ArrayBuffer);
  } finally {
    await drive.files.delete({ supportsAllDrives: true, fileId: tempDocId });
  }
}

type Admin = ReturnType<typeof createServiceRoleClient>;

export async function submitVocationalProgressReport(
  admin: Admin,
  input: {
    reportData: {
      Date: string;
      ClientName: string;
      ServiceStage: string;
      EmploymentSpecialistName: string;
      Notes: string;
      /** Optional — add {{BillableHours}} near the bottom of the VPR Google Doc template. */
      BillableHours?: string;
    };
    wayfinderClientId: string;
    reportingState: "GA" | "TN";
    submittedByUserId: string;
    submitterEmail: string;
  }
): Promise<{ driveFileId: string | null; driveFileName: string; driveUrl: string | null }> {
  const { data: config } = await admin
    .from("admin_config")
    .select("drive_folders, doc_templates")
    .limit(1)
    .maybeSingle();
  const folders = (config?.drive_folders as Record<string, unknown>) || {};
  const vprByStage = (folders.vpr_by_stage as Record<string, string>) || {};
  const folderId =
    (vprByStage[input.reportData.ServiceStage] as string) || (folders.vpr_default as string);
  const templateId =
    (config?.doc_templates as Record<string, string> | undefined)?.vpr ||
    process.env.VPR_TEMPLATE_ID;
  if (!folderId || !templateId) {
    throw new Error(
      "Drive folders and templates must be configured in Admin Portal before submitting reports."
    );
  }

  await admin.from("vpr_submissions").insert({
    date: input.reportData.Date,
    client_name: input.reportData.ClientName,
    service_stage: input.reportData.ServiceStage,
    employment_specialist_name: input.reportData.EmploymentSpecialistName,
    notes: input.reportData.Notes,
    user_email: input.submitterEmail,
  });

  const auth = await getGoogleAuth();
  const pdfBytes = await generateVprPdf(auth, input.reportData, { templateId, folderId });

  const drive = google.drive({ version: "v3", auth });
  const fileName = `${input.reportData.ClientName || "Client"} - ${input.reportData.EmploymentSpecialistName || "Specialist"} - ${input.reportData.Date} Report.pdf`;
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

  const { error: formalErr } = await admin.from("formal_report_submissions").insert({
    wayfinder_client_id: input.wayfinderClientId,
    client_name: input.reportData.ClientName.trim(),
    state: input.reportingState,
    report_type_slug: "vpr",
    reporting_month: input.reportData.Date?.slice(0, 7) ?? null,
    submitted_by: input.submittedByUserId,
    submitted_by_name: input.reportData.EmploymentSpecialistName,
    drive_file_id: driveFileId,
    drive_file_name: fileName,
    field_snapshot: input.reportData,
  });
  if (formalErr) {
    console.error("formal_report_submissions insert failed:", formalErr.message);
  }

  const mail = await renderTemplatedFlatEmail(admin, "report_vpr_completed", {
    client_name: String(input.reportData.ClientName ?? ""),
    specialist_name: String(input.reportData.EmploymentSpecialistName ?? ""),
    report_name: "Vocational Progress Report",
  });

  await sendEmail(auth, {
    to: input.submitterEmail,
    subject: mail.subject,
    text: mail.text,
    attachments: [
      {
        filename: fileName,
        content: pdfBytes.toString("base64"),
        encoding: "base64",
        mimeType: "application/pdf",
      },
    ],
  });

  return {
    driveFileId,
    driveFileName: fileName,
    driveUrl: driveFileUrl(driveFileId),
  };
}
