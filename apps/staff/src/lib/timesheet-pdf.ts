import {
  DEVELOPER_BADGE_LOGO_PATH,
  WAYFINDER_LOGO_PATH,
  WAYFINDER_PWA_ICON_PATH,
} from "@wayfinder/branding";
import { displayServiceTimes, minutesToDecimalHours } from "@wayfinder/supabase/es-time-tracking";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFFont, type PDFPage } from "pdf-lib";
import JSZip from "jszip";
import type { EsTimeEntryRow } from "@/lib/es-time-data";

export type ClientTimesheetPdfInput = {
  clientName: string;
  esName: string;
  weekStart: string;
  weekEnd: string;
  entries: EsTimeEntryRow[];
  approvedAt: string | null;
  approvedByName: string | null;
  publicDir: string;
};

export type ClientTimesheetGroup = {
  clientId: string;
  clientName: string;
  entries: EsTimeEntryRow[];
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LOGO_MAX_WIDTH = 200;
const BODY_SIZE = 10;
const HEADING_SIZE = 13;
const TITLE_SIZE = 16;

function formatDisplayDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${isoDate}T12:00:00`));
}

function formatApprovedAt(iso: string | null): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function sanitizeFilename(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "client";
}

function resolveJoshuaTreeLogo(publicDir: string): { bytes: Uint8Array; kind: "png" | "jpg" } | null {
  const candidates = [
    DEVELOPER_BADGE_LOGO_PATH,
    WAYFINDER_LOGO_PATH,
    WAYFINDER_PWA_ICON_PATH,
    "/favicon.png",
  ];

  for (const rel of candidates) {
    const filePath = path.join(publicDir, rel.replace(/^\//, ""));
    if (!existsSync(filePath)) continue;
    const bytes = readFileSync(filePath);
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
      return { bytes, kind: "jpg" };
    }
    return { bytes, kind: "png" };
  }

  return null;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = words[0] ?? "";

  for (const word of words.slice(1)) {
    const next = `${current} ${word}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

async function embedLogo(
  pdfDoc: PDFDocument,
  publicDir: string
): Promise<{ image: PDFImage; width: number; height: number } | null> {
  const logo = resolveJoshuaTreeLogo(publicDir);
  if (!logo) return null;

  const image =
    logo.kind === "jpg" ? await pdfDoc.embedJpg(logo.bytes) : await pdfDoc.embedPng(logo.bytes);
  const scale = LOGO_MAX_WIDTH / image.width;
  return {
    image,
    width: image.width * scale,
    height: image.height * scale,
  };
}

function drawTableRow(
  page: PDFPage,
  font: PDFFont,
  fontBold: PDFFont,
  y: number,
  cells: string[],
  bold = false
): number {
  const activeFont = bold ? fontBold : font;
  const colX = [MARGIN, 92, 220, 292, 354, 392] as const;
  const colWidths = [48, 120, 66, 56, 32, PAGE_WIDTH - MARGIN - 392] as const;

  page.drawLine({
    start: { x: MARGIN, y: y + 4 },
    end: { x: PAGE_WIDTH - MARGIN, y: y + 4 },
    thickness: bold ? 1 : 0.5,
    color: rgb(0.75, 0.75, 0.75),
  });

  let maxLines = 1;
  const wrappedCells = cells.map((cell, index) => {
    const lines = wrapText(cell, activeFont, BODY_SIZE, colWidths[index] - 4);
    maxLines = Math.max(maxLines, lines.length);
    return lines;
  });

  for (let lineIndex = 0; lineIndex < maxLines; lineIndex += 1) {
    wrappedCells.forEach((lines, index) => {
      const text = lines[lineIndex] ?? "";
      if (!text) return;
      page.drawText(text, {
        x: colX[index],
        y: y - lineIndex * 12,
        size: BODY_SIZE,
        font: activeFont,
        color: rgb(0.1, 0.1, 0.1),
      });
    });
  }

  return y - maxLines * 12 - 6;
}

export async function buildClientTimesheetPdf(input: ClientTimesheetPdfInput): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  let y = PAGE_HEIGHT - MARGIN;
  const logo = await embedLogo(pdfDoc, input.publicDir);
  if (logo) {
    page.drawImage(logo.image, {
      x: (PAGE_WIDTH - logo.width) / 2,
      y: y - logo.height,
      width: logo.width,
      height: logo.height,
    });
    y -= logo.height + 24;
  }

  const title = "Timesheet — Vocational Services";
  const titleWidth = fontBold.widthOfTextAtSize(title, TITLE_SIZE);
  page.drawText(title, {
    x: (PAGE_WIDTH - titleWidth) / 2,
    y,
    size: TITLE_SIZE,
    font: fontBold,
    color: rgb(0.12, 0.35, 0.2),
  });
  y -= 28;

  const metaLines = [
    `Client: ${input.clientName}`,
    `Employment Specialist: ${input.esName}`,
    `Pay week: ${formatDisplayDate(input.weekStart)} – ${formatDisplayDate(input.weekEnd)}`,
  ];

  const approvedLabel = formatApprovedAt(input.approvedAt);
  if (approvedLabel) {
    const approver = input.approvedByName ? ` by ${input.approvedByName}` : "";
    metaLines.push(`Supervisor approved: ${approvedLabel}${approver}`);
  }

  for (const line of metaLines) {
    page.drawText(line, {
      x: MARGIN,
      y,
      size: HEADING_SIZE,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 18;
  }

  y -= 8;
  y = drawTableRow(
    page,
    font,
    fontBold,
    y,
    ["Date", "Activity", "Start", "End", "Min", "Narrative"],
    true
  );

  const sortedEntries = [...input.entries].sort((a, b) =>
    a.service_date.localeCompare(b.service_date)
  );

  for (const entry of sortedEntries) {
    if (y < MARGIN + 60) {
      break;
    }
    const times = displayServiceTimes(entry);
    y = drawTableRow(page, font, fontBold, y, [
      formatDisplayDate(entry.service_date),
      entry.activity_name,
      times.start,
      times.end,
      String(entry.duration_minutes),
      entry.narrative ?? "",
    ]);
  }

  const totalMinutes = input.entries.reduce((sum, entry) => sum + entry.duration_minutes, 0);
  y -= 8;
  page.drawText(`Total for client: ${minutesToDecimalHours(totalMinutes)} hours`, {
    x: MARGIN,
    y,
    size: HEADING_SIZE,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  return pdfDoc.save();
}

export function groupApprovedClientEntries(entries: EsTimeEntryRow[]): ClientTimesheetGroup[] {
  const groups = new Map<string, ClientTimesheetGroup>();

  for (const entry of entries) {
    if (entry.status !== "approved" || !entry.client_id) continue;
    const existing = groups.get(entry.client_id) ?? {
      clientId: entry.client_id,
      clientName: entry.client_name ?? "Client",
      entries: [],
    };
    existing.entries.push(entry);
    groups.set(entry.client_id, existing);
  }

  return [...groups.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export async function buildClientTimesheetPdfZip(
  groups: ClientTimesheetGroup[],
  shared: Omit<ClientTimesheetPdfInput, "clientName" | "entries">
): Promise<Uint8Array> {
  const zip = new JSZip();

  for (const group of groups) {
    const pdfBytes = await buildClientTimesheetPdf({
      ...shared,
      clientName: group.clientName,
      entries: group.entries,
    });
    const filename = `timesheet-${sanitizeFilename(group.clientName)}-${shared.weekStart}.pdf`;
    zip.file(filename, pdfBytes);
  }

  return zip.generateAsync({ type: "uint8array" });
}
