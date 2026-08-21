import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import type { InvoicePacketPdfData } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { getGoogleAuth } from "@/lib/google-mail";
import {
  fillGoogleDocTemplatePdf,
  invoicePacketPlaceholders,
  loadPreEtsSignatureTempFolderId,
} from "@/lib/pre-ets-google-doc";
import { buildPreEtsCarPdf, type CarPdfInput } from "@/lib/pre-ets-car-export";
import {
  generatePreEtsInvoiceAttestationPdf,
  generatePreEtsInvoiceCoverPdf,
  generatePreEtsInvoiceDetailPdf,
  generatePreEtsInvoicePacketPdf,
} from "@/lib/pre-ets-invoice-pdf";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

export type InvoiceExportResult = {
  contentType: string;
  fileName: string;
  buffer: Uint8Array;
  exportKind: "pdf" | "zip";
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    if (!part || part.length === 0) continue;
    try {
      const doc = await PDFDocument.load(part);
      const pages = await merged.copyPages(doc, doc.getPageIndices());
      for (const page of pages) merged.addPage(page);
    } catch {
      // Skip unreadable parts (e.g. non-PDF Drive uploads).
    }
  }
  return merged.save();
}

function baseFileName(data: InvoicePacketPdfData): string {
  const auth = data.authNumber || data.packetId.slice(0, 8);
  return `pre-ets-invoice-${data.authType}-${auth}-${data.serviceMonth}`;
}

async function downloadDriveFileBytes(fileId: string): Promise<Uint8Array | null> {
  try {
    const auth = await getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const meta = await drive.files.get({
      supportsAllDrives: true,
      fileId,
      fields: "id, mimeType",
    });
    const mime = meta.data.mimeType ?? "";

    if (mime === "application/vnd.google-apps.document") {
      const exported = await drive.files.export(
        { supportsAllDrives: true, fileId, mimeType: "application/pdf" } as {
          fileId: string;
          mimeType: string;
        },
        { responseType: "arraybuffer" }
      );
      return new Uint8Array(exported.data as ArrayBuffer);
    }

    const media = await drive.files.get(
      { supportsAllDrives: true, fileId, alt: "media" } as {
        fileId: string;
        alt: string;
      },
      { responseType: "arraybuffer" }
    );
    return new Uint8Array(media.data as ArrayBuffer);
  } catch {
    return null;
  }
}

async function buildSessionCarPdf(
  admin: SupabaseClient,
  sessionId: string,
  settings: PreEtsSettingsRow
): Promise<Uint8Array | null> {
  if (!settings.template_car_doc_id) return null;

  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select(
      "id, session_date, instructor_name, primary_instructor_user_id, co_instructor_user_id, pre_ets_authorizations(auth_number, service_code, service_label), pre_ets_schools(name), pre_ets_activity_reports(*)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session) return null;
  const report = relationOne(
    session.pre_ets_activity_reports as Record<string, unknown> | Record<string, unknown>[] | null
  );
  if (!report) return null;
  const status = report.status as string | undefined;
  if (status !== "submitted" && status !== "late_submitted") return null;

  const authRow = relationOne(
    session.pre_ets_authorizations as
      | { auth_number: string | null; service_code: string; service_label: string | null }
      | { auth_number: string | null; service_code: string; service_label: string | null }[]
      | null
  );
  const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);

  const input: CarPdfInput = {
    sessionDate: (report.session_date as string | null) ?? (session.session_date as string | null),
    schoolName: school?.name ?? "",
    authNumber: authRow?.auth_number ?? "",
    instructorName: (session.instructor_name as string) ?? "",
    serviceCode: authRow?.service_code ?? "",
    lessonTopic: (report.lesson_topic as string | null) ?? null,
    learningObjective: (report.learning_objective as string | null) ?? null,
    lessonStructure: (report.lesson_structure as string | null) ?? null,
    participantCount:
      typeof report.participant_count === "number" ? report.participant_count : null,
    studentsOnTime: (report.students_on_time as boolean | null) ?? null,
    studentsEngaged: (report.students_engaged as boolean | null) ?? null,
    studentsParticipated: (report.students_participated as boolean | null) ?? null,
    studentsDisruptive: (report.students_disruptive as boolean | null) ?? null,
    facultyPresent: (report.faculty_present as boolean | null) ?? null,
    additionalNotes: (report.additional_notes as string | null) ?? null,
    signatureData: (report.signature_data as string | null) ?? null,
    signedDate: (report.signed_date as string | null) ?? null,
  };

  try {
    return await buildPreEtsCarPdf(input, settings, admin);
  } catch {
    return null;
  }
}

async function buildCombinedInvoiceDocPdf(
  data: InvoicePacketPdfData,
  settings: PreEtsSettingsRow,
  admin: SupabaseClient
): Promise<Uint8Array | null> {
  const templateId =
    settings.template_invoice_cover_doc_id || settings.template_invoice_attestation_doc_id;
  if (!templateId) return null;

  const signatureData = data.accountsSignatureData?.startsWith("data:image/")
    ? data.accountsSignatureData
    : null;
  const images = signatureData
    ? [
        { tag: "AccountsSignature", dataUrl: signatureData },
        { tag: "ProviderSignature", dataUrl: signatureData },
      ]
    : [];

  const signatureFolderId = await loadPreEtsSignatureTempFolderId(admin);

  try {
    return await fillGoogleDocTemplatePdf(
      templateId,
      invoicePacketPlaceholders(data),
      `Pre-ETS Invoice - ${data.authNumber || data.packetId.slice(0, 8)}`,
      { images, signatureFolderId }
    );
  } catch {
    return null;
  }
}

/**
 * Full packet: Invoice cover+attestation Doc, then each session's CAR + signed roster
 * in chronological order. Missing CAR/roster pieces are skipped.
 */
export async function buildInvoicePacketExport(
  data: InvoicePacketPdfData,
  settings: PreEtsSettingsRow,
  admin?: SupabaseClient
): Promise<InvoiceExportResult> {
  const fileBase = baseFileName(data);
  const mode = settings.invoice_export_mode;
  const combinedTemplateId =
    settings.template_invoice_cover_doc_id || settings.template_invoice_attestation_doc_id;
  const coverId = settings.template_invoice_cover_doc_id;
  const attestationId = settings.template_invoice_attestation_doc_id;
  const sameCombinedDoc =
    Boolean(coverId && attestationId && coverId === attestationId) ||
    Boolean(coverId && !attestationId) ||
    Boolean(!coverId && attestationId);

  const parts: Uint8Array[] = [];

  if (combinedTemplateId && admin && sameCombinedDoc) {
    const invoiceDocPdf = await buildCombinedInvoiceDocPdf(data, settings, admin);
    if (invoiceDocPdf) parts.push(invoiceDocPdf);

    for (const session of data.sessions) {
      if (session.hasActivityReport) {
        const car = await buildSessionCarPdf(admin, session.sessionId, settings);
        if (car) parts.push(car);
      }
      if (session.signedRosterDriveFileId) {
        const roster = await downloadDriveFileBytes(session.signedRosterDriveFileId);
        if (roster) parts.push(roster);
      }
    }

    if (parts.length > 0) {
      const combinedPdf = await mergePdfs(parts);
      if (mode === "sections_only") {
        const zip = new JSZip();
        zip.file("01-invoice.pdf", parts[0] ?? combinedPdf);
        let idx = 2;
        for (let i = 1; i < parts.length; i++) {
          zip.file(`${String(idx).padStart(2, "0")}-attachment.pdf`, parts[i]);
          idx += 1;
        }
        return {
          exportKind: "zip",
          contentType: "application/zip",
          fileName: `${fileBase}-sections.zip`,
          buffer: await zip.generateAsync({ type: "uint8array" }),
        };
      }
      if (mode === "both") {
        const zip = new JSZip();
        zip.file("combined.pdf", combinedPdf);
        zip.file("01-invoice.pdf", parts[0] ?? combinedPdf);
        return {
          exportKind: "zip",
          contentType: "application/zip",
          fileName: `${fileBase}-packet.zip`,
          buffer: await zip.generateAsync({ type: "uint8array" }),
        };
      }
      return {
        exportKind: "pdf",
        contentType: "application/pdf",
        fileName: `${fileBase}.pdf`,
        buffer: combinedPdf,
      };
    }
  }

  // Legacy path: separate cover/attestation templates + built-in detail pages.
  const placeholders = invoicePacketPlaceholders(data);
  const coverFromTemplate = settings.template_invoice_cover_doc_id
    ? await fillGoogleDocTemplatePdf(
        settings.template_invoice_cover_doc_id,
        placeholders,
        `Pre-ETS Invoice Cover - ${fileBase}`,
        admin
          ? {
              images: data.accountsSignatureData?.startsWith("data:image/")
                ? [
                    {
                      tag: "AccountsSignature",
                      dataUrl: data.accountsSignatureData,
                    },
                    {
                      tag: "ProviderSignature",
                      dataUrl: data.accountsSignatureData,
                    },
                  ]
                : [],
              signatureFolderId: await loadPreEtsSignatureTempFolderId(admin),
            }
          : undefined
      ).catch(() => null)
    : null;

  const attestationFromTemplate =
    settings.template_invoice_attestation_doc_id &&
    settings.template_invoice_attestation_doc_id !== settings.template_invoice_cover_doc_id
      ? await fillGoogleDocTemplatePdf(
          settings.template_invoice_attestation_doc_id,
          placeholders,
          `Pre-ETS Invoice Attestation - ${fileBase}`
        ).catch(() => null)
      : null;

  const detailPdf = await generatePreEtsInvoiceDetailPdf(data);
  const coverPdf = coverFromTemplate ?? (await generatePreEtsInvoiceCoverPdf(data));
  const attestationPdf =
    attestationFromTemplate ?? (await generatePreEtsInvoiceAttestationPdf(data));
  const fullPdf = await generatePreEtsInvoicePacketPdf(data);

  if (mode === "sections_only") {
    const zip = new JSZip();
    zip.file("01-cover.pdf", coverPdf);
    zip.file("02-detail.pdf", detailPdf);
    zip.file("03-attestation.pdf", attestationPdf);
    return {
      exportKind: "zip",
      contentType: "application/zip",
      fileName: `${fileBase}-sections.zip`,
      buffer: await zip.generateAsync({ type: "uint8array" }),
    };
  }

  const hasGoogleTemplates = Boolean(coverFromTemplate || attestationFromTemplate);
  const combinedPdf = hasGoogleTemplates
    ? await mergePdfs(
        attestationFromTemplate
          ? [coverPdf, detailPdf, attestationPdf]
          : [coverPdf, detailPdf]
      )
    : fullPdf;

  if (mode === "both") {
    const zip = new JSZip();
    zip.file("combined.pdf", combinedPdf);
    zip.file("01-cover.pdf", coverPdf);
    zip.file("02-detail.pdf", detailPdf);
    zip.file("03-attestation.pdf", attestationPdf);
    return {
      exportKind: "zip",
      contentType: "application/zip",
      fileName: `${fileBase}-packet.zip`,
      buffer: await zip.generateAsync({ type: "uint8array" }),
    };
  }

  return {
    exportKind: "pdf",
    contentType: "application/pdf",
    fileName: `${fileBase}.pdf`,
    buffer: combinedPdf,
  };
}
