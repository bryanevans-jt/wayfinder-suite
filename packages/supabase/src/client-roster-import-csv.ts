export const ROSTER_IMPORT_COLUMNS = [
  "client_name",
  "counselor",
  "es_email",
  "employment_goal",
] as const;

export type RosterImportColumn = (typeof ROSTER_IMPORT_COLUMNS)[number];

export type RosterImportInputRow = Record<RosterImportColumn, string>;

export type RosterImportPreview = {
  totalRows: number;
  validRows: number;
  issues: string[];
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      cells.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells;
}

export function parseRosterImportCsv(text: string): {
  rows: RosterImportInputRow[];
  error?: string;
} {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) {
    return { rows: [], error: "CSV is empty." };
  }

  const headerCells = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const missing = ROSTER_IMPORT_COLUMNS.filter((col) => !headerCells.includes(col));
  if (missing.length > 0) {
    return {
      rows: [],
      error: `Missing required columns: ${missing.join(", ")}`,
    };
  }

  const indexByCol = new Map<RosterImportColumn, number>();
  for (const col of ROSTER_IMPORT_COLUMNS) {
    indexByCol.set(col, headerCells.indexOf(col));
  }

  const rows: RosterImportInputRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row = {} as RosterImportInputRow;
    for (const col of ROSTER_IMPORT_COLUMNS) {
      const idx = indexByCol.get(col)!;
      row[col] = (cells[idx] ?? "").trim();
    }
    if (ROSTER_IMPORT_COLUMNS.every((col) => !row[col])) {
      continue;
    }
    rows.push(row);
  }

  return { rows };
}

export function analyzeRosterImportCsv(rows: RosterImportInputRow[]): RosterImportPreview {
  const issues: string[] = [];
  let validRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const line = i + 2;
    if (!row.client_name.trim()) {
      issues.push(`Row ${line}: client_name is required.`);
      continue;
    }
    validRows++;
  }
  return { totalRows: rows.length, validRows, issues };
}
