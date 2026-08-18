import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export type RosterPdfStudent = {
  participantId: string;
  fullName: string;
};

export type RosterPdfInput = {
  authorizationNumber: string;
  authType?: "group" | "individual" | "pending";
  sessionDate: string | null;
  schoolName: string;
  instructorName: string;
  topic: string;
  serviceCode: string;
  students: RosterPdfStudent[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const ROW_HEIGHT = 22;

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

export async function generatePreEtsRosterPdf(input: RosterPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const draw = (text: string, opts?: { bold?: boolean; size?: number }) => {
    const size = opts?.size ?? 10;
    const f = opts?.bold ? fontBold : font;
    page.drawText(text, { x: MARGIN, y, size, font: f, color: rgb(0, 0, 0) });
    y -= size + 4;
  };

  draw("Joshua Tree Service Group", { bold: true, size: 14 });
  draw(`Pre-ETS Time Sheet`, { bold: true, size: 12 });
  y -= 8;

  const authLabel =
    input.authType === "individual" ? "Individual Authorization #" : "Group Authorization #";
  draw(`${authLabel}: ${input.authorizationNumber || "_______________"}`);
  draw(`Date: ${input.sessionDate || "_______________"}`);
  draw(`School: ${input.schoolName}`);
  draw(`Instructor: ${input.instructorName || "_______________"}`);
  draw(`Topic: ${input.topic || "_______________"}`);
  draw(`Service Code: ${input.serviceCode}`);
  y -= 8;

  const colX = {
    pid: MARGIN,
    name: MARGIN + 80,
    signature: MARGIN + 280,
    date: MARGIN + 430,
  };

  page.drawText("Participant ID", { x: colX.pid, y, size: 9, font: fontBold });
  page.drawText("Student Name", { x: colX.name, y, size: 9, font: fontBold });
  page.drawText("Student Signature", { x: colX.signature, y, size: 9, font: fontBold });
  page.drawText("Date", { x: colX.date, y, size: 9, font: fontBold });
  y -= ROW_HEIGHT;

  for (const student of input.students) {
    if (y < MARGIN + 120) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
    page.drawText(student.participantId, { x: colX.pid, y, size: 9, font });
    page.drawText(student.fullName.slice(0, 32), { x: colX.name, y, size: 9, font });
    page.drawLine({
      start: { x: colX.signature, y: y - 2 },
      end: { x: colX.signature + 130, y: y - 2 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    page.drawLine({
      start: { x: colX.date, y: y - 2 },
      end: { x: colX.date + 80, y: y - 2 },
      thickness: 0.5,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= ROW_HEIGHT;
  }

  y -= 16;
  const attestation =
    "I hereby attest that this information is true, accurate, and complete and understand that any falsification, omission, or concealment of material fact may subject me or the represented organization to administrative, civil, or criminal liability. Furthermore, I am a duly authorized representative to sign such agreement for the party I represent.";

  if (y < MARGIN + 80) {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  for (const line of wrapText(attestation, PAGE_WIDTH - MARGIN * 2, font, 8)) {
    page.drawText(line, { x: MARGIN, y, size: 8, font });
    y -= 10;
  }

  y -= 12;
  page.drawText("Instructor Signature:", { x: MARGIN, y, size: 9, font: fontBold });
  page.drawLine({
    start: { x: MARGIN + 110, y: y - 2 },
    end: { x: MARGIN + 350, y: y - 2 },
    thickness: 0.5,
  });
  page.drawText("Date:", { x: MARGIN + 370, y, size: 9, font: fontBold });
  page.drawLine({
    start: { x: MARGIN + 400, y: y - 2 },
    end: { x: MARGIN + 500, y: y - 2 },
    thickness: 0.5,
  });

  return doc.save();
}
