import { minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import {
  DEVELOPER_BADGE_LOGO_PATH,
  WAYFINDER_FAVICON_PATH,
  WAYFINDER_LOGO_PATH,
} from "@wayfinder/branding";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";

export type VocationalServiceRenderedLine = {
  serviceDate: string;
  startTime: string;
  endTime: string;
  activityName: string;
  clientPresent: boolean;
  deliveryMode: string | null;
  narrative: string;
  hours: number;
};

export type VocationalServiceRenderedInput = {
  serviceName: string;
  clientName: string;
  esName: string;
  counselorName: string;
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  lines: VocationalServiceRenderedLine[];
  publicDir: string;
};

const PAGE_WIDTH = 612;
const MARGIN = 48;
const BODY = 10;
const TITLE = 16;

function resolveLogo(publicDir: string): { bytes: Uint8Array; kind: "png" | "jpg" } | null {
  for (const rel of [DEVELOPER_BADGE_LOGO_PATH, WAYFINDER_LOGO_PATH, WAYFINDER_FAVICON_PATH]) {
    const filePath = path.join(publicDir, rel.replace(/^\//, ""));
    if (!existsSync(filePath)) continue;
    const bytes = readFileSync(filePath);
    return {
      bytes,
      kind: filePath.toLowerCase().endsWith(".jpg") ? "jpg" : "png",
    };
  }
  return null;
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines: string[] = [];
  let cur = words[0] ?? "";
  for (const w of words.slice(1)) {
    const next = `${cur} ${w}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  lines.push(cur);
  return lines;
}

function fmtDate(ymd: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${ymd}T12:00:00`));
}

export async function buildVocationalServiceRenderedPdf(
  input: VocationalServiceRenderedInput
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  let page = pdf.addPage([612, 792]);
  let y = 792 - MARGIN;

  const logo = resolveLogo(input.publicDir);
  if (logo) {
    const image: PDFImage =
      logo.kind === "jpg" ? await pdf.embedJpg(logo.bytes) : await pdf.embedPng(logo.bytes);
    const scale = 160 / image.width;
    page.drawImage(image, {
      x: MARGIN,
      y: y - image.height * scale,
      width: image.width * scale,
      height: image.height * scale,
    });
    y -= image.height * scale + 16;
  }

  page.drawText("Vocational Service Rendered", {
    x: MARGIN,
    y: y - TITLE,
    size: TITLE,
    font: bold,
    color: rgb(0.1, 0.35, 0.2),
  });
  y -= TITLE + 20;

  const meta: [string, string][] = [
    ["Service", input.serviceName],
    ["Client", input.clientName],
    ["Employment Specialist", input.esName],
    ["Counselor", input.counselorName],
    ["Total hours", minutesToDecimalHours(Math.round(input.totalHours * 60))],
    [
      "Report period",
      `${fmtDate(input.periodStart)} – ${fmtDate(input.periodEnd)}`,
    ],
  ];

  for (const [label, value] of meta) {
    page.drawText(`${label}:`, { x: MARGIN, y: y - BODY, size: BODY, font: bold });
    page.drawText(value, { x: MARGIN + 130, y: y - BODY, size: BODY, font });
    y -= BODY + 4;
  }

  y -= 12;
  page.drawText("Activity detail (chronological)", {
    x: MARGIN,
    y: y - BODY,
    size: BODY + 1,
    font: bold,
  });
  y -= BODY + 10;

  for (const line of input.lines) {
    if (y < MARGIN + 80) {
      page = pdf.addPage([612, 792]);
      y = 792 - MARGIN;
    }

    const header = `${fmtDate(line.serviceDate)} · ${line.startTime} – ${line.endTime} · ${line.activityName} · ${line.hours.toFixed(2)} hrs`;
    page.drawText(header, { x: MARGIN, y: y - BODY, size: BODY, font: bold });
    y -= BODY + 2;

    const flags = [
      line.clientPresent ? "Client present" : "Client not present",
      line.deliveryMode ? line.deliveryMode.replace(/_/g, " ") : "—",
    ].join(" · ");

    page.drawText(flags, { x: MARGIN, y: y - BODY, size: BODY - 1, font });
    y -= BODY + 2;

    for (const nl of wrap(line.narrative || "—", font, BODY - 1, PAGE_WIDTH - MARGIN * 2)) {
      if (y < MARGIN + 40) {
        page = pdf.addPage([612, 792]);
        y = 792 - MARGIN;
      }
      page.drawText(nl, { x: MARGIN, y: y - (BODY - 1), size: BODY - 1, font });
      y -= BODY;
    }
    y -= 8;
  }

  if (y < MARGIN + 30) {
    page = pdf.addPage([612, 792]);
    y = 792 - MARGIN;
  }
  page.drawText(`Total hours: ${minutesToDecimalHours(Math.round(input.totalHours * 60))}`, {
    x: MARGIN,
    y: y - BODY,
    size: BODY + 1,
    font: bold,
  });

  return pdf.save();
}

export function vocationalServiceRenderedCsv(input: VocationalServiceRenderedInput): string {
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const header =
    "service_date,start_time,end_time,activity,client_present,delivery_mode,narrative,hours\n";
  const rows = input.lines.map((l) =>
    [
      l.serviceDate,
      l.startTime,
      l.endTime,
      esc(l.activityName),
      l.clientPresent ? "yes" : "no",
      l.deliveryMode ?? "",
      esc(l.narrative),
      l.hours.toFixed(2),
    ].join(",")
  );
  return header + rows.join("\n");
}
