import { google } from "googleapis";
import { PDFDocument } from "pdf-lib";
import { fillGoogleDocTemplatePdf, type GoogleDocInlineImage } from "@/lib/pre-ets-google-doc";
import { expandIjpInvoiceTableInDoc } from "@/lib/ijp-google-doc-invoice-table";
import { embedIjpAttestationParticipantSignature } from "@/lib/ijp-attestation-signature-pdf";
import { getGoogleAuth } from "@/lib/google-mail";
import type { IjpInvoiceLineItem } from "@wayfinder/supabase/ijp-billing-lines";

const LINE_PLACEHOLDER_KEYS = new Set([
  "LineAuthorization",
  "LineServiceCode",
  "LineDescription",
  "LineServiceDate",
  "LineStartTime",
  "LineEndTime",
  "LineHours",
  "LineAmount",
  "LineInstructor",
  "InvoiceLine",
]);

export async function exportIjpInvoicePdf(opts: {
  templateDocId: string;
  tempName: string;
  headerPlaceholders: Record<string, string>;
  lines: IjpInvoiceLineItem[];
  signatureFolderId?: string | null;
}): Promise<Uint8Array> {
  const auth = await getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const copy = await drive.files.copy({
    supportsAllDrives: true,
    fileId: opts.templateDocId,
    requestBody: { name: `[TEMP] ${opts.tempName}` },
  });
  const tempDocId = copy.data.id;
  if (!tempDocId) {
    throw new Error("Could not copy the IJP invoice Google Doc template.");
  }

  try {
    await expandIjpInvoiceTableInDoc(docs, tempDocId, opts.lines);

    const textPlaceholders = Object.fromEntries(
      Object.entries(opts.headerPlaceholders).filter(([key]) => !LINE_PLACEHOLDER_KEYS.has(key))
    );

    const requests = Object.entries(textPlaceholders).map(([key, value]) => ({
      replaceAllText: {
        containsText: { text: `{{${key}}}`, matchCase: false },
        replaceText: String(value ?? ""),
      },
    }));

    if (requests.length > 0) {
      await docs.documents.batchUpdate({
        documentId: tempDocId,
        requestBody: { requests },
      });
    }

    const pdfRes = await drive.files.export(
      { supportsAllDrives: true, fileId: tempDocId, mimeType: "application/pdf" } as {
        fileId: string;
        mimeType: string;
      },
      { responseType: "arraybuffer" }
    );
    return new Uint8Array(pdfRes.data as ArrayBuffer);
  } finally {
    await drive.files.delete({ supportsAllDrives: true, fileId: tempDocId }).catch(() => undefined);
  }
}

export async function exportIjpAttestationPdf(opts: {
  templateDocId: string;
  tempName: string;
  placeholders: Record<string, string>;
  signatureDataUrl?: string | null;
  signatureFolderId?: string | null;
}): Promise<Uint8Array> {
  const pdfFromDoc = await fillGoogleDocTemplatePdf(
    opts.templateDocId,
    opts.placeholders,
    opts.tempName,
    {
      images: [],
      signatureFolderId: opts.signatureFolderId,
    }
  );

  const sig = opts.signatureDataUrl?.trim();
  if (sig?.startsWith("data:image/")) {
    return embedIjpAttestationParticipantSignature(pdfFromDoc, sig);
  }
  return pdfFromDoc;
}

export async function mergePdfBuffers(first: Uint8Array, second: Uint8Array): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  const a = await PDFDocument.load(first);
  const b = await PDFDocument.load(second);
  const pagesA = await merged.copyPages(a, a.getPageIndices());
  pagesA.forEach((p) => merged.addPage(p));
  const pagesB = await merged.copyPages(b, b.getPageIndices());
  pagesB.forEach((p) => merged.addPage(p));
  return merged.save();
}
