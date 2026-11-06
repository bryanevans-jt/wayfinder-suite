import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs";
import path from "path";
import type { WrtLessonWithBlocks, WrtModuleWithLessons } from "@wayfinder/supabase/staff-wrt-shared";

const BRAND_GREEN = rgb(0.15, 0.45, 0.2);
const TEXT_DIM = rgb(0.25, 0.25, 0.25);

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (next.length <= maxCharsPerLine) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = w.length > maxCharsPerLine ? w.slice(0, maxCharsPerLine) : w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

async function drawLogoHeader(
  pdf: PDFDocument,
  page: import("pdf-lib").PDFPage,
  fontBold: import("pdf-lib").PDFFont,
  y: number
): Promise<number> {
  let yCursor = y;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const pngBytes = fs.readFileSync(logoPath);
    const img = await pdf.embedPng(pngBytes);
    const w = 120;
    const scale = w / img.width;
    const h = img.height * scale;
    page.drawImage(img, { x: 50, y: yCursor - h, width: w, height: h });
    yCursor -= h + 6;
  } catch {
    // logo optional
  }
  page.drawText("Joshua Tree Service Group · Workplace Readiness Training", {
    x: 50,
    y: yCursor,
    size: 9,
    font: fontBold,
    color: TEXT_DIM,
  });
  return yCursor - 18;
}

/**
 * Printable facilitator page(s) for one lesson — branding via Joshua Tree logo when present.
 */
export async function buildWrtLessonPdf(
  mod: WrtModuleWithLessons,
  lesson: WrtLessonWithBlocks,
  opts?: { fileNameBase?: string }
): Promise<{ bytes: Uint8Array; fileName: string }> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([612, 792]);
  let { width, height } = page.getSize();
  let y = height - 48;
  y = await drawLogoHeader(pdf, page, fontBold, y);

  page.drawText(lesson.title, {
    x: 50,
    y: y,
    size: 14,
    font: fontBold,
    color: BRAND_GREEN,
    maxWidth: width - 100,
  });
  y -= 22;
  page.drawText(`Module: ${mod.title}`, {
    x: 50,
    y,
    size: 10,
    font,
    color: TEXT_DIM,
    maxWidth: width - 100,
  });
  y -= 16;

  const sections: Array<{ label: string; body: string }> = [
    { label: "Objectives", body: lesson.objectives ?? "" },
    { label: "Desired outcomes", body: lesson.desired_outcomes ?? "" },
    { label: "Facilitator notes", body: lesson.facilitator_notes ?? "" },
    { label: "Citations", body: lesson.citations ?? "" },
  ];

  for (const s of sections) {
    if (!s.body.trim()) continue;
    page.drawText(`${s.label}:`, { x: 50, y, size: 10, font: fontBold, color: BRAND_GREEN });
    y -= 12;
    for (const line of wrapText(s.body, 95)) {
      if (y < 56) {
        page = pdf.addPage([612, 792]);
        ({ width, height } = page.getSize());
        y = height - 48;
      }
      page.drawText(line, { x: 50, y, size: 9, font, color: TEXT_DIM, maxWidth: width - 100 });
      y -= 11;
    }
    y -= 6;
  }

  page.drawText("Lesson content blocks", {
    x: 50,
    y,
    size: 11,
    font: fontBold,
    color: BRAND_GREEN,
  });
  y -= 14;

  const blocks = [...lesson.blocks].sort((a, b) => a.sort_order - b.sort_order);
  for (const b of blocks) {
    const header = `${b.block_type}${b.title ? ` — ${b.title}` : ""}`;
    if (y < 100) {
      page = pdf.addPage([612, 792]);
      ({ width, height } = page.getSize());
      y = height - 48;
    }
    page.drawText(header, { x: 50, y, size: 9, font: fontBold, color: TEXT_DIM });
    y -= 11;
    if (b.body?.trim()) {
      for (const line of wrapText(b.body, 95)) {
        if (y < 50) {
          page = pdf.addPage([612, 792]);
          ({ width, height } = page.getSize());
          y = height - 48;
        }
        page.drawText(line, { x: 56, y, size: 8, font, color: TEXT_DIM });
        y -= 10;
      }
    }
    if (b.url?.trim()) {
      const u = `Link: ${b.url}`;
      for (const line of wrapText(u, 95)) {
        if (y < 50) {
          page = pdf.addPage([612, 792]);
          ({ width, height } = page.getSize());
          y = height - 48;
        }
        page.drawText(line, { x: 56, y, size: 8, font, color: rgb(0.1, 0.35, 0.55) });
        y -= 10;
      }
    }
    y -= 8;
  }

  const bytes = await pdf.save();
  const safe = (opts?.fileNameBase ?? `${mod.slug}-${lesson.slug}`).replace(/[^a-z0-9-_]+/gi, "-");
  return { bytes, fileName: `${safe}.pdf` };
}
