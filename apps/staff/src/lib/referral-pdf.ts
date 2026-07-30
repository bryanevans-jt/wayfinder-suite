import {
  DEVELOPER_BADGE_LOGO_PATH,
  WAYFINDER_LOGO_PATH,
  WAYFINDER_PWA_ICON_PATH,
} from "@wayfinder/branding";
import { intakeStatusLabel } from "@wayfinder/supabase/referral-labels";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  referralAddressLine,
  type ReferralExportRow,
} from "@/lib/referral-export-data";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const LANDSCAPE_WIDTH = 792;
const LANDSCAPE_HEIGHT = 612;
const MARGIN = 40;
const BODY_SIZE = 10;
const HEADING_SIZE = 12;
const TITLE_SIZE = 16;

function sanitizeFilename(value: string): string {
  return (
    value
      .trim()
      .replace(/[<>:"/\\|?*]/g, "")
      .replace(/\s+/g, "-")
      .slice(0, 80) || "referral"
  );
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

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function wrapText(font: PDFFont, text: string, size: number, maxWidth: number): string[] {
  const words = (text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  if (words.length === 0) return ["—"];
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : ["—"];
}

async function drawLogo(
  pdfDoc: PDFDocument,
  page: PDFPage,
  publicDir: string,
  x: number,
  y: number
): Promise<number> {
  const logo = resolveJoshuaTreeLogo(publicDir);
  if (!logo) return 0;
  const image =
    logo.kind === "jpg" ? await pdfDoc.embedJpg(logo.bytes) : await pdfDoc.embedPng(logo.bytes);
  const maxW = 140;
  const scale = Math.min(1, maxW / image.width);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, { x, y: y - h, width: w, height: h });
  return h;
}

export function referralPdfFilename(row: ReferralExportRow): string {
  const name = sanitizeFilename(row.full_name || row.contact_email || row.id);
  return `referral-${name}.pdf`;
}

export function referralListPdfFilename(): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `referral-queue-${stamp}.pdf`;
}

export async function buildReferralDetailPdf(
  row: ReferralExportRow,
  publicDir: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const logoH = await drawLogo(pdfDoc, page, publicDir, MARGIN, y);
  y -= Math.max(logoH, 20) + 16;

  page.drawText("Referral Detail", {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: bold,
    color: rgb(0.1, 0.35, 0.2),
  });
  y -= 22;

  const sections: Array<{ title: string; fields: Array<[string, string]> }> = [
    {
      title: "Status",
      fields: [
        ["Stage", row.stageLabel],
        ["Intake Status", intakeStatusLabel(row.intake_status)],
        ["State", row.referral_state || "—"],
        ["Service", row.serviceName || "—"],
        ["Referred", formatWhen(row.referred_at)],
        ["Authorization #", row.authorization_number || "—"],
        ["Override Reason", row.authorization_override_reason || "—"],
      ],
    },
    {
      title: "Counselor Information",
      fields: [
        ["Counselor Name", row.counselorName || "—"],
        ["Counselor Email", row.counselorEmail || "—"],
        ["Counselor Availability", row.counselor_availability || "—"],
      ],
    },
    {
      title: "Client Referral",
      fields: [
        ["Client Full Legal Name", row.full_name || "—"],
        ["Date Of Birth", row.date_of_birth || "—"],
        ["Primary Phone", row.primary_phone || "—"],
        ["Secondary Phone", row.secondary_phone || "—"],
        ["Address", referralAddressLine(row) || "—"],
        ["Email Address", row.contact_email || "—"],
        ["Gender", row.gender || "—"],
        ["Ethnicity/Race", row.ethnicity || "—"],
        ["Disability/History", row.disability_history || "—"],
        ["Work Goal", row.employment_goal_primary || "—"],
        ["Meeting Option", row.meeting_preference || "—"],
      ],
    },
    {
      title: "Attachments",
      fields:
        row.documents.length > 0
          ? row.documents.map((d) => [
              d.kind === "authorizations" ? "Authorizations" : "Other Documents",
              d.file_name,
            ])
          : [["Documents", "None"]],
    },
  ];

  const maxWidth = PAGE_WIDTH - MARGIN * 2;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  }

  for (const section of sections) {
    ensureSpace(40);
    page.drawText(section.title, {
      x: MARGIN,
      y,
      size: HEADING_SIZE,
      font: bold,
      color: rgb(0.12, 0.12, 0.12),
    });
    y -= 16;

    for (const [label, value] of section.fields) {
      const labelText = `${label}: `;
      const labelW = bold.widthOfTextAtSize(labelText, BODY_SIZE);
      const valueLines = wrapText(font, value, BODY_SIZE, maxWidth - labelW);
      ensureSpace(14 * valueLines.length + 4);
      page.drawText(labelText, { x: MARGIN, y, size: BODY_SIZE, font: bold });
      page.drawText(valueLines[0], {
        x: MARGIN + labelW,
        y,
        size: BODY_SIZE,
        font,
      });
      y -= 13;
      for (let i = 1; i < valueLines.length; i++) {
        page.drawText(valueLines[i], {
          x: MARGIN + labelW,
          y,
          size: BODY_SIZE,
          font,
        });
        y -= 13;
      }
      y -= 2;
    }
    y -= 10;
  }

  return pdfDoc.save();
}

type Col = { key: string; header: string; width: number; value: (r: ReferralExportRow) => string };

export async function buildReferralListPdf(
  rows: ReferralExportRow[],
  publicDir: string
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const cols: Col[] = [
    { key: "client", header: "Client", width: 90, value: (r) => r.full_name || r.contact_email || r.id },
    { key: "counselor", header: "Counselor", width: 80, value: (r) => r.counselorName || "—" },
    { key: "state", header: "State", width: 32, value: (r) => r.referral_state || "—" },
    { key: "service", header: "Service", width: 95, value: (r) => r.serviceName || "—" },
    { key: "stage", header: "Stage", width: 75, value: (r) => r.stageLabel },
    { key: "dob", header: "DOB", width: 55, value: (r) => r.date_of_birth || "—" },
    { key: "phone", header: "Phone", width: 70, value: (r) => r.primary_phone || "—" },
    { key: "email", header: "Email", width: 95, value: (r) => r.contact_email || "—" },
    { key: "auth", header: "Auth #", width: 55, value: (r) => r.authorization_number || "—" },
  ];

  let page = pdfDoc.addPage([LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT]);
  let y = LANDSCAPE_HEIGHT - MARGIN;

  const logoH = await drawLogo(pdfDoc, page, publicDir, MARGIN, y);
  y -= Math.max(logoH, 18) + 12;

  page.drawText("Referral Queue Export", {
    x: MARGIN,
    y,
    size: TITLE_SIZE,
    font: bold,
    color: rgb(0.1, 0.35, 0.2),
  });
  y -= 16;
  page.drawText(`${rows.length} referral${rows.length === 1 ? "" : "s"} · ${formatWhen(new Date().toISOString())}`, {
    x: MARGIN,
    y,
    size: 9,
    font,
    color: rgb(0.35, 0.35, 0.35),
  });
  y -= 18;

  const rowH = 28;
  const headerH = 16;
  const tableLeft = MARGIN;
  const textSize = 7.5;

  function drawHeader() {
    let x = tableLeft;
    for (const col of cols) {
      page.drawText(col.header, { x, y, size: 8, font: bold });
      x += col.width;
    }
    y -= headerH;
    page.drawLine({
      start: { x: tableLeft, y: y + 10 },
      end: { x: tableLeft + cols.reduce((s, c) => s + c.width, 0), y: y + 10 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
  }

  drawHeader();

  for (const row of rows) {
    if (y < MARGIN + rowH) {
      page = pdfDoc.addPage([LANDSCAPE_WIDTH, LANDSCAPE_HEIGHT]);
      y = LANDSCAPE_HEIGHT - MARGIN;
      drawHeader();
    }

    let x = tableLeft;
    let maxLines = 1;
    const cellLines = cols.map((col) => {
      const lines = wrapText(font, col.value(row), textSize, col.width - 4);
      maxLines = Math.max(maxLines, Math.min(lines.length, 3));
      return lines.slice(0, 3);
    });

    for (let i = 0; i < cols.length; i++) {
      const lines = cellLines[i];
      for (let li = 0; li < lines.length; li++) {
        page.drawText(lines[li], {
          x,
          y: y - li * 9,
          size: textSize,
          font,
        });
      }
      x += cols[i].width;
    }
    y -= Math.max(rowH, maxLines * 9 + 6);
  }

  // Second pass: detail blocks for disability / work goal / meeting (full submitted info)
  for (const row of rows) {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
    page.drawText(row.full_name || row.contact_email || "Referral", {
      x: MARGIN,
      y,
      size: HEADING_SIZE,
      font: bold,
    });
    y -= 18;

    const detailFields: Array<[string, string]> = [
      ["Stage", row.stageLabel],
      ["State", row.referral_state || "—"],
      ["Service", row.serviceName || "—"],
      ["Counselor", `${row.counselorName || "—"} (${row.counselorEmail || "—"})`],
      ["Referred", formatWhen(row.referred_at)],
      ["Date Of Birth", row.date_of_birth || "—"],
      ["Primary Phone", row.primary_phone || "—"],
      ["Secondary Phone", row.secondary_phone || "—"],
      ["Address", referralAddressLine(row) || "—"],
      ["Email", row.contact_email || "—"],
      ["Gender", row.gender || "—"],
      ["Ethnicity/Race", row.ethnicity || "—"],
      ["Disability/History", row.disability_history || "—"],
      ["Work Goal", row.employment_goal_primary || "—"],
      ["Meeting Option", row.meeting_preference || "—"],
      ["Counselor Availability", row.counselor_availability || "—"],
      ["Authorization #", row.authorization_number || "—"],
      [
        "Documents",
        row.documents.length
          ? row.documents.map((d) => d.file_name).join(", ")
          : "None",
      ],
    ];

    const maxWidth = PAGE_WIDTH - MARGIN * 2;
    for (const [label, value] of detailFields) {
      const labelText = `${label}: `;
      const labelW = bold.widthOfTextAtSize(labelText, BODY_SIZE);
      const valueLines = wrapText(font, value, BODY_SIZE, maxWidth - labelW);
      if (y - 13 * valueLines.length < MARGIN) {
        page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        y = PAGE_HEIGHT - MARGIN;
      }
      page.drawText(labelText, { x: MARGIN, y, size: BODY_SIZE, font: bold });
      page.drawText(valueLines[0], { x: MARGIN + labelW, y, size: BODY_SIZE, font });
      y -= 13;
      for (let i = 1; i < valueLines.length; i++) {
        page.drawText(valueLines[i], { x: MARGIN + labelW, y, size: BODY_SIZE, font });
        y -= 13;
      }
      y -= 3;
    }
  }

  return pdfDoc.save();
}
