import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatPreEtsRateDollars } from "@wayfinder/supabase/pre-ets-settings";
import type { InvoicePacketPdfData } from "@wayfinder/supabase/pre-ets-invoice-packet";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const ROW_HEIGHT = 16;

function wrapText(
  text: string,
  maxWidth: number,
  font: { widthOfTextAtSize: (t: string, s: number) => number },
  size: number
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generatePreEtsInvoicePacketPdf(
  data: InvoicePacketPdfData
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (text: string, opts?: { bold?: boolean; size?: number; indent?: number }) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? fontBold : font;
    const x = MARGIN + (opts?.indent ?? 0);
    page.drawText(text, { x, y, size, font: f, color: rgb(0, 0, 0) });
    y -= size + 4;
  };

  const ensureSpace = (needed: number) => {
    if (y < MARGIN + needed) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  draw(data.providerName, { bold: true, size: 14 });
  for (const line of wrapText(data.remitAddress, PAGE_WIDTH - MARGIN * 2, font, 9)) {
    draw(line, { size: 9 });
  }
  y -= 8;

  draw(data.authType === "individual" ? "Pre-ETS Individual Invoice Packet" : "Pre-ETS Group Invoice Packet", {
    bold: true,
    size: 12,
  });
  y -= 4;
  draw(`Service month: ${data.serviceMonth}`);
  draw(`School: ${data.schoolName}`);
  draw(
    `${data.authType === "individual" ? "Individual" : "Group"} authorization #: ${data.authNumber || "—"}`
  );
  if (data.invoiceNumber) {
    draw(`Provider invoice #: ${data.invoiceNumber}`);
  }
  draw(`Service code: ${data.serviceCode}${data.serviceLabel ? ` — ${data.serviceLabel}` : ""}`);
  draw(`Rate per unit: $${formatPreEtsRateDollars(data.rateCents)}`);
  draw(`Total billable units: ${data.totalUnits}`);
  draw(`Total amount: $${(data.totalAmountCents / 100).toFixed(2)}`, { bold: true });
  y -= 8;

  draw(
    data.authType === "individual" ? "Student (billable attendance)" : "Participants (billable attendance)",
    { bold: true, size: 11 }
  );
  y -= 4;

  const colX = { pid: MARGIN, name: MARGIN + 100, units: MARGIN + 380 };
  page.drawText("PID #", { x: colX.pid, y, size: 9, font: fontBold });
  page.drawText("Student name", { x: colX.name, y, size: 9, font: fontBold });
  page.drawText("Units", { x: colX.units, y, size: 9, font: fontBold });
  y -= ROW_HEIGHT;

  for (const p of data.participants) {
    ensureSpace(ROW_HEIGHT + 20);
    page.drawText(p.participantId, { x: colX.pid, y, size: 9, font });
    page.drawText(p.fullName.slice(0, 40), { x: colX.name, y, size: 9, font });
    page.drawText(String(p.units), { x: colX.units, y, size: 9, font });
    y -= ROW_HEIGHT;
  }

  if (data.participants.length === 0) {
    draw("No billable attendance recorded for completed sessions.", { size: 9 });
  }

  y -= 12;
  ensureSpace(80);
  draw("Session attendance detail", { bold: true, size: 11 });
  y -= 4;

  const lineCol = { date: MARGIN, pid: MARGIN + 90, name: MARGIN + 180 };
  page.drawText("Session date", { x: lineCol.date, y, size: 8, font: fontBold });
  page.drawText("PID #", { x: lineCol.pid, y, size: 8, font: fontBold });
  page.drawText("Student", { x: lineCol.name, y, size: 8, font: fontBold });
  y -= ROW_HEIGHT;

  for (const line of data.sessionLines) {
    ensureSpace(ROW_HEIGHT + 20);
    page.drawText(line.sessionDate ?? "—", { x: lineCol.date, y, size: 8, font });
    page.drawText(line.participantId, { x: lineCol.pid, y, size: 8, font });
    page.drawText(line.fullName.slice(0, 36), { x: lineCol.name, y, size: 8, font });
    y -= ROW_HEIGHT;
  }

  y -= 16;
  ensureSpace(100);
  const attestation =
    "I hereby certify that the Pre-ETS services listed above were provided in accordance with the approved authorization and that attendance documentation is on file. This invoice packet is submitted for payment through the Georgia Vocational Rehabilitation Agency portal.";

  for (const line of wrapText(attestation, PAGE_WIDTH - MARGIN * 2, font, 8)) {
    ensureSpace(12);
    page.drawText(line, { x: MARGIN, y, size: 8, font });
    y -= 10;
  }

  y -= 16;
  ensureSpace(40);
  page.drawText("Authorized signature:", { x: MARGIN, y, size: 9, font: fontBold });
  page.drawLine({
    start: { x: MARGIN + 120, y: y - 2 },
    end: { x: MARGIN + 360, y: y - 2 },
    thickness: 0.5,
  });
  page.drawText("Date:", { x: MARGIN + 380, y, size: 9, font: fontBold });
  page.drawLine({
    start: { x: MARGIN + 410, y: y - 2 },
    end: { x: MARGIN + 500, y: y - 2 },
    thickness: 0.5,
  });

  return doc.save();
}
