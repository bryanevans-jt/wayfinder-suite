import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IjpBillingSettingsRow } from "@wayfinder/supabase/ijp-billing-settings";
import { clientDisplayName } from "@wayfinder/branding";
import { serviceMonthLabel } from "@wayfinder/supabase/ijp-billing-eligibility";
import { downloadDriveFileBytes } from "@/lib/pre-ets-drive-download";
import { mergePdfBuffers } from "@/lib/ijp-billing-doc-pdf";
import { compileIjpInvoicePdf } from "@/lib/ijp-billing-service";
import JSZip from "jszip";

export async function buildMissingAttestationNoticePdf(opts: {
  clientName: string;
  serviceMonth: string;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const monthLabel = serviceMonthLabel(opts.serviceMonth);
  page.drawText("IJP attestation missing", { x: 72, y: 720, size: 16, font: bold, color: rgb(0.6, 0.2, 0) });
  page.drawText(`Client: ${opts.clientName}`, { x: 72, y: 690, size: 12, font });
  page.drawText(`Service month: ${monthLabel}`, { x: 72, y: 670, size: 12, font });
  page.drawText(
    "This download includes the invoice only. Obtain a signed IJP client attestation before billing submission.",
    { x: 72, y: 640, size: 11, font }
  );
  return pdf.save();
}

export async function buildIjpInvoiceDownloadPdf(
  admin: SupabaseClient,
  invoiceId: string,
  settings: IjpBillingSettingsRow
): Promise<{ buffer: Uint8Array; fileName: string; missingAttestation: boolean }> {
  const { data: invoice } = await admin
    .from("ijp_billing_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!invoice) throw new Error("Invoice not found.");

  const { data: client } = await admin
    .from("clients")
    .select("full_name, contact_email, id")
    .eq("id", invoice.client_id)
    .maybeSingle();
  const name = clientDisplayName(client ?? { id: invoice.client_id as string });
  const monthStart = invoice.service_month as string;
  const monthKey = monthStart.slice(0, 7);

  let invoicePdf: Uint8Array | null = null;
  if (invoice.combined_drive_file_id) {
    invoicePdf = await downloadDriveFileBytes(invoice.combined_drive_file_id as string);
  }
  if (!invoicePdf && invoice.invoice_only_drive_file_id) {
    invoicePdf = await downloadDriveFileBytes(invoice.invoice_only_drive_file_id as string);
  }
  if (!invoicePdf) {
    const compiled = await compileIjpInvoicePdf(admin, invoiceId, settings);
    invoicePdf = await downloadDriveFileBytes(compiled.invoiceOnlyFileId);
  }
  if (!invoicePdf) throw new Error("Could not load invoice PDF.");

  const { data: att } = await admin
    .from("ijp_monthly_attestations")
    .select("attestation_drive_file_id")
    .eq("client_id", invoice.client_id)
    .eq("service_month", monthStart)
    .eq("is_test", invoice.is_test)
    .maybeSingle();

  const hasAttestation = Boolean(att?.attestation_drive_file_id);
  let combined = invoicePdf;
  if (hasAttestation && att?.attestation_drive_file_id) {
    const attPdf = await downloadDriveFileBytes(att.attestation_drive_file_id as string);
    if (attPdf) {
      combined = await mergePdfBuffers(invoicePdf, attPdf);
    }
  } else if (!hasAttestation) {
    const notice = await buildMissingAttestationNoticePdf({ clientName: name, serviceMonth: monthStart });
    combined = await mergePdfBuffers(notice, invoicePdf);
  }

  const safeName = name.replace(/[<>:"/\\|?*]/g, "").trim() || "client";
  const fileName = `${safeName} - IJP Invoice - ${monthKey}.pdf`;
  return { buffer: combined, fileName, missingAttestation: !hasAttestation };
}

export async function buildIjpInvoicesZip(
  admin: SupabaseClient,
  invoiceIds: string[],
  settings: IjpBillingSettingsRow
): Promise<{ buffer: Uint8Array; fileName: string }> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const id of invoiceIds) {
    try {
      const { buffer, fileName } = await buildIjpInvoiceDownloadPdf(admin, id, settings);
      let entryName = fileName;
      let n = 2;
      while (usedNames.has(entryName)) {
        entryName = fileName.replace(/\.pdf$/i, ` (${n}).pdf`);
        n += 1;
      }
      usedNames.add(entryName);
      zip.file(entryName, buffer);
    } catch (e) {
      console.error("ijp zip skip", id, e);
    }
  }

  const buffer = await zip.generateAsync({ type: "uint8array" });
  return { buffer, fileName: "ijp-invoices.zip" };
}
