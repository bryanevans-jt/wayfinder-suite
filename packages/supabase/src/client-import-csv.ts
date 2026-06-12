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
