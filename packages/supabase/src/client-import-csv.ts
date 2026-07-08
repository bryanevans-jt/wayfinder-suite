export const CLIENT_IMPORT_COLUMNS = [
  "client_name",
  "email",
  "office",
  "service",
  "counselor",
  "es_email",
  "send_invite",
] as const;

export type ClientImportColumn = (typeof CLIENT_IMPORT_COLUMNS)[number];

export type ClientImportInputRow = Record<ClientImportColumn, string>;

export type ClientImportPreviewIssue = {
  row: number;
  email: string;
  clientName: string;
  issues: string[];
};

export type ClientImportPreview = {
  rowCount: number;
  duplicateEmails: string[];
  issues: ClientImportPreviewIssue[];
  readyCount: number;
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Validates parsed rows before import — duplicate emails and missing required fields. */
export function analyzeClientImportCsv(rows: ClientImportInputRow[]): ClientImportPreview {
  const emailRows = new Map<string, number[]>();
  const issues: ClientImportPreviewIssue[] = [];

  rows.forEach((row, index) => {
    const rowNum = index + 2;
    const rowIssues: string[] = [];
    const email = row.email.trim().toLowerCase();
    const clientName = row.client_name.trim();

    if (!clientName) {
      rowIssues.push("Client name is required");
    }
    if (email) {
      if (!isValidEmail(email)) {
        rowIssues.push("Email does not look valid");
      } else {
        const existing = emailRows.get(email) ?? [];
        existing.push(rowNum);
        emailRows.set(email, existing);
      }
    }
    if (!row.office.trim()) {
      rowIssues.push("Office is required");
    }
    if (!row.service.trim()) {
      rowIssues.push("Service is required");
    }
    if (!row.counselor.trim()) {
      rowIssues.push("Counselor is required");
    }

    if (rowIssues.length > 0) {
      issues.push({
        row: rowNum,
        email: row.email.trim() || "—",
        clientName: clientName || "—",
        issues: rowIssues,
      });
    }
  });

  const duplicateEmails = [...emailRows.entries()]
    .filter(([, nums]) => nums.length > 1)
    .map(([email]) => email);

  for (const email of duplicateEmails) {
    const rowNums = emailRows.get(email)!;
    for (const rowNum of rowNums) {
      const existing = issues.find((i) => i.row === rowNum);
      const dupMsg = `Duplicate email in file (also on row${rowNums.length > 2 ? "s" : ""} ${rowNums.filter((n) => n !== rowNum).join(", ")})`;
      if (existing) {
        if (!existing.issues.includes(dupMsg)) {
          existing.issues.push(dupMsg);
        }
      } else {
        const row = rows[rowNum - 2]!;
        issues.push({
          row: rowNum,
          email: row.email.trim(),
          clientName: row.client_name.trim() || "—",
          issues: [dupMsg],
        });
      }
    }
  }

  issues.sort((a, b) => a.row - b.row);

  const issueRows = new Set(issues.map((i) => i.row));
  const readyCount = rows.length - issueRows.size;

  return {
    rowCount: rows.length,
    duplicateEmails,
    issues,
    readyCount: Math.max(0, readyCount),
  };
}

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

/** Parses CSV text into row objects keyed by header names. */
export function parseClientImportCsv(text: string): ClientImportInputRow[] {
  const cleaned = text.replace(/^\uFEFF/, "").trim();
  if (!cleaned) {
    return [];
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && cleaned[i + 1] === "\n") {
        i++;
      }
      row.push(field);
      field = "";
      if (row.some((c) => c.trim().length > 0)) {
        rows.push(row);
      }
      row = [];
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.trim().length > 0)) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const header = rows[0]!.map((h) => normKey(h));
  for (const col of CLIENT_IMPORT_COLUMNS) {
    if (!header.includes(col)) {
      throw new Error(`Missing required column "${col}" in CSV header`);
    }
  }

  const dataRows = rows.slice(1).filter((r) => r.some((c) => c.trim().length > 0));

  return dataRows.map((cells) => {
    const record = {} as ClientImportInputRow;
    for (const col of CLIENT_IMPORT_COLUMNS) {
      const idx = header.indexOf(col);
      record[col] = idx >= 0 ? (cells[idx] ?? "").trim() : "";
    }
    return record;
  });
}
