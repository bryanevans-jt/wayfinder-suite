import * as XLSX from "xlsx";

export type WorksheetUploadFormat = "csv" | "xlsx" | "xls";

export type WorkbookDistrictSheet = {
  sheetName: string;
  csvText: string;
};

export type SkippedWorkbookSheet = {
  sheetName: string;
  reason: string;
};

const CSV_EXTENSIONS = new Set(["csv"]);
const EXCEL_EXTENSIONS = new Set(["xlsx", "xls"]);

export function detectWorksheetUploadFormat(
  fileName: string,
  mimeType?: string | null
): WorksheetUploadFormat | null {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (CSV_EXTENSIONS.has(ext)) return "csv";
  if (EXCEL_EXTENSIONS.has(ext)) return ext === "xls" ? "xls" : "xlsx";

  const mime = (mimeType ?? "").toLowerCase();
  if (mime.includes("csv") || mime === "text/plain") return "csv";
  if (mime.includes("spreadsheetml") || mime.includes("excel")) return "xlsx";
  if (mime === "application/vnd.ms-excel") return "xls";

  return null;
}

export type ReadWorkbookDistrictSheetsResult = {
  sheets: WorkbookDistrictSheet[];
  skipped: SkippedWorkbookSheet[];
};

/** Convert each workbook tab to CSV text for the existing district worksheet parser. */
export function readWorkbookDistrictSheets(buffer: Buffer): ReadWorkbookDistrictSheetsResult {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheets: WorkbookDistrictSheet[] = [];
  const skipped: SkippedWorkbookSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const csvText = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false }).trim();
    if (!csvText) {
      skipped.push({
        sheetName,
        reason:
          'Tab has no data. Copy the billing title, "DISTRICT N SCHOOLS" row, and school blocks from another district tab.',
      });
      continue;
    }
    sheets.push({ sheetName, csvText });
  }

  return { sheets, skipped };
}

export async function worksheetFileToDistrictCsvTexts(
  file: Pick<File, "name" | "type"> & { arrayBuffer(): Promise<ArrayBuffer> }
): Promise<{
  format: WorksheetUploadFormat;
  sheets: WorkbookDistrictSheet[];
  skipped: SkippedWorkbookSheet[];
}> {
  const format = detectWorksheetUploadFormat(file.name, file.type);
  if (!format) {
    throw new Error("Upload a CSV (.csv) or Excel workbook (.xlsx, .xls).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (format === "csv") {
    const csvText = buffer.toString("utf-8");
    return { format, sheets: [{ sheetName: file.name, csvText }], skipped: [] };
  }

  const { sheets, skipped } = readWorkbookDistrictSheets(buffer);
  if (sheets.length === 0 && skipped.length === 0) {
    throw new Error("The Excel workbook has no sheets.");
  }
  if (sheets.length === 0) {
    throw new Error(
      "Every workbook tab is empty. Add district billing rows to each tab, or upload one district as CSV."
    );
  }

  return { format, sheets, skipped };
}
