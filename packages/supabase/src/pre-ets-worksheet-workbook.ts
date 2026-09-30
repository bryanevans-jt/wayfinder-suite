import * as XLSX from "xlsx";

export type WorksheetUploadFormat = "csv" | "xlsx" | "xls";

export type WorkbookDistrictSheet = {
  sheetName: string;
  csvText: string;
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

/** Convert each workbook tab to CSV text for the existing district worksheet parser. */
export function readWorkbookDistrictSheets(buffer: Buffer): WorkbookDistrictSheet[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const sheets: WorkbookDistrictSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;
    const csvText = XLSX.utils.sheet_to_csv(worksheet, { blankrows: false }).trim();
    if (!csvText) continue;
    sheets.push({ sheetName, csvText });
  }

  return sheets;
}

export async function worksheetFileToDistrictCsvTexts(
  file: Pick<File, "name" | "type"> & { arrayBuffer(): Promise<ArrayBuffer> }
): Promise<{ format: WorksheetUploadFormat; sheets: WorkbookDistrictSheet[] }> {
  const format = detectWorksheetUploadFormat(file.name, file.type);
  if (!format) {
    throw new Error("Upload a CSV (.csv) or Excel workbook (.xlsx, .xls).");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (format === "csv") {
    const csvText = buffer.toString("utf-8");
    return { format, sheets: [{ sheetName: file.name, csvText }] };
  }

  const sheets = readWorkbookDistrictSheets(buffer);
  if (sheets.length === 0) {
    throw new Error("The Excel workbook has no non-empty sheets.");
  }

  return { format, sheets };
}
