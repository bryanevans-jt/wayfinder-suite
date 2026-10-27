import { PDFDocument, rgb } from "pdf-lib";

/** Layout for default GVRA IJP attestation Google Doc (US Letter, first page). */
export const IJP_ATTESTATION_PARTICIPANT_SIGNATURE_PT = {
  x: 108,
  yFromBottom: 154,
  width: 180,
  height: 48,
};

function signatureBytesFromDataUrl(dataUrl: string): { bytes: Uint8Array; mime: string } {
  if (!dataUrl.startsWith("data:image/")) {
    throw new Error("Invalid signature image data.");
  }
  const match = /^data:(image\/\w+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Invalid signature image data.");
  const mime = match[1].toLowerCase();
  const bytes = Uint8Array.from(Buffer.from(match[2], "base64"));
  if (bytes.byteLength < 8) {
    throw new Error("Signature image is empty.");
  }
  return { bytes, mime };
}

/** Embed participant signature bytes in the PDF (avoids broken Drive-linked images after export). */
export async function embedIjpAttestationParticipantSignature(
  pdfBytes: Uint8Array,
  signatureDataUrl: string
): Promise<Uint8Array> {
  const { bytes, mime } = signatureBytesFromDataUrl(signatureDataUrl);
  const pdf = await PDFDocument.load(pdfBytes);
  const page = pdf.getPage(0);
  const { x, yFromBottom, width, height } = IJP_ATTESTATION_PARTICIPANT_SIGNATURE_PT;
  const y = yFromBottom;

  const image =
    mime.includes("png") ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);

  page.drawRectangle({
    x,
    y,
    width,
    height,
    color: rgb(1, 1, 1),
    borderWidth: 0,
  });

  const scale = Math.min(width / image.width, height / image.height, 1);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  page.drawImage(image, {
    x: x + (width - drawW) / 2,
    y: y + (height - drawH) / 2,
    width: drawW,
    height: drawH,
  });

  return pdf.save();
}
