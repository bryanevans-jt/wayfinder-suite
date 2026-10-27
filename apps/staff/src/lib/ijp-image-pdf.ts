import { PDFDocument } from "pdf-lib";

const MAX_BYTES = 10 * 1024 * 1024;

/** Single-page PDF wrapping one photo scan (max 10 MB input). */
export async function imageBytesToSinglePagePdf(bytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  if (bytes.byteLength > MAX_BYTES) {
    throw new Error("Image must be 10 MB or smaller.");
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const lower = mimeType.toLowerCase();

  if (lower.includes("png")) {
    const img = await pdf.embedPng(bytes);
    const scale = Math.min(512 / img.width, 700 / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (612 - w) / 2, y: 792 - h - 46, width: w, height: h });
  } else if (lower.includes("jpeg") || lower.includes("jpg")) {
    const img = await pdf.embedJpg(bytes);
    const scale = Math.min(512 / img.width, 700 / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (612 - w) / 2, y: 792 - h - 46, width: w, height: h });
  } else {
    throw new Error("Upload a PDF or a JPEG/PNG photo.");
  }

  return pdf.save();
}

export function decodeUploadPayload(opts: {
  uploadPdfBase64?: string | null;
  uploadImageBase64?: string | null;
  uploadMimeType?: string | null;
}): Promise<Uint8Array> {
  if (opts.uploadPdfBase64) {
    const bytes = Uint8Array.from(Buffer.from(opts.uploadPdfBase64, "base64"));
    if (bytes.byteLength > MAX_BYTES) {
      throw new Error("PDF must be 10 MB or smaller.");
    }
    return Promise.resolve(bytes);
  }
  if (opts.uploadImageBase64) {
    const mime = opts.uploadMimeType?.trim() || "image/jpeg";
    const bytes = Uint8Array.from(Buffer.from(opts.uploadImageBase64, "base64"));
    return imageBytesToSinglePagePdf(bytes, mime);
  }
  throw new Error("Upload file is required.");
}
