import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import type { InvoicePacketPdfData } from "@wayfinder/supabase/pre-ets-invoice-packet";
import { fillGoogleDocTemplatePdf, invoicePacketPlaceholders } from "@/lib/pre-ets-google-doc";
import {
  generatePreEtsInvoiceAttestationPdf,
  generatePreEtsInvoiceCoverPdf,
  generatePreEtsInvoiceDetailPdf,
  generatePreEtsInvoicePacketPdf,
} from "@/lib/pre-ets-invoice-pdf";

export type InvoiceExportResult = {
  contentType: string;
  fileName: string;
  buffer: Uint8Array;
  exportKind: "pdf" | "zip";
};

async function mergePdfs(parts: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const part of parts) {
    const doc = await PDFDocument.load(part);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    for (const page of pages) merged.addPage(page);
  }
  return merged.save();
}

function baseFileName(data: InvoicePacketPdfData): string {
  const auth = data.authNumber || data.packetId.slice(0, 8);
  return `pre-ets-invoice-${data.authType}-${auth}-${data.serviceMonth}`;
}

export async function buildInvoicePacketExport(
  data: InvoicePacketPdfData,
  settings: PreEtsSettingsRow
): Promise<InvoiceExportResult> {
  const placeholders = invoicePacketPlaceholders(data);
  const mode = settings.invoice_export_mode;
  const fileBase = baseFileName(data);

  const coverFromTemplate = settings.template_invoice_cover_doc_id
    ? await fillGoogleDocTemplatePdf(
        settings.template_invoice_cover_doc_id,
        placeholders,
        `Pre-ETS Invoice Cover - ${fileBase}`
      ).catch(() => null)
    : null;

  const attestationFromTemplate = settings.template_invoice_attestation_doc_id
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
    ? await mergePdfs([coverPdf, detailPdf, attestationPdf])
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
