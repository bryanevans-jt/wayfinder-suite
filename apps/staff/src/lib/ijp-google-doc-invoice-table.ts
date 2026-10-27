import type { docs_v1 } from "googleapis";
import {
  truncateIjpLineDescription,
  type IjpInvoiceLineItem,
} from "@wayfinder/supabase/ijp-billing-lines";
import { formatIjpInvoiceAmount } from "@wayfinder/supabase/ijp-billing-settings";

type StructuralElement = docs_v1.Schema$StructuralElement;
type TableCell = docs_v1.Schema$TableCell;

const LINE_TAGS = [
  "LineAuthorization",
  "LineServiceCode",
  "LineDescription",
  "LineServiceDate",
  "LineStartTime",
  "LineEndTime",
  "LineHours",
  "LineAmount",
  "LineInstructor",
  "InvoiceLine",
] as const;

function cellPlainText(cell: TableCell | undefined): string {
  if (!cell?.content) return "";
  let text = "";
  for (const block of cell.content) {
    for (const el of block.paragraph?.elements ?? []) {
      text += el.textRun?.content ?? "";
    }
  }
  return text;
}

function findTagColumn(rowCells: TableCell[] | undefined, tags: string[]): number {
  if (!rowCells) return -1;
  for (let c = 0; c < rowCells.length; c++) {
    const text = cellPlainText(rowCells[c]);
    if (tags.some((tag) => text.includes(`{{${tag}}}`))) return c;
  }
  return -1;
}

function findInvoiceTable(content: StructuralElement[] | undefined): {
  tableStartIndex: number;
  templateRowIndex: number;
  columns: Record<string, number>;
} | null {
  if (!content) return null;

  for (const el of content) {
    const table = el.table;
    const tableStartIndex = el.startIndex;
    if (!table?.tableRows || tableStartIndex == null) continue;

    for (let r = 0; r < table.tableRows.length; r++) {
      const cells = table.tableRows[r].tableCells ?? [];
      const rowText = cells.map(cellPlainText).join(" ");
      const looksLikeTemplate =
        rowText.includes("{{InvoiceLine}}") ||
        rowText.includes("{{LineHours}}") ||
        rowText.includes("{{LineDescription}}");

      if (!looksLikeTemplate) continue;

      return {
        tableStartIndex,
        templateRowIndex: r,
        columns: {
          authorization: findTagColumn(cells, ["LineAuthorization"]),
          serviceCode: findTagColumn(cells, ["LineServiceCode"]),
          description: findTagColumn(cells, ["LineDescription", "InvoiceLine"]),
          serviceDate: findTagColumn(cells, ["LineServiceDate"]),
          startTime: findTagColumn(cells, ["LineStartTime"]),
          endTime: findTagColumn(cells, ["LineEndTime"]),
          hours: findTagColumn(cells, ["LineHours"]),
          amount: findTagColumn(cells, ["LineAmount"]),
          instructor: findTagColumn(cells, ["LineInstructor"]),
        },
      };
    }
  }
  return null;
}

function cellRewriteRequests(cell: TableCell, text: string): docs_v1.Schema$Request[] {
  if (cell.startIndex == null || cell.endIndex == null) return [];
  const start = cell.startIndex;
  const end = cell.endIndex;
  const requests: docs_v1.Schema$Request[] = [];
  if (end - start > 2) {
    requests.push({
      deleteContentRange: {
        range: { startIndex: start + 1, endIndex: end - 1 },
      },
    });
  }
  if (text) {
    requests.push({
      insertText: {
        location: { index: start + 1 },
        text,
      },
    });
  }
  return requests;
}

export async function expandIjpInvoiceTableInDoc(
  docs: docs_v1.Docs,
  documentId: string,
  lines: IjpInvoiceLineItem[]
): Promise<boolean> {
  const initial = await docs.documents.get({ documentId });
  const found = findInvoiceTable(initial.data.body?.content ?? undefined);
  if (!found) return false;

  const { tableStartIndex, templateRowIndex, columns } = found;
  const rowCount = Math.max(1, lines.length);
  const extraRows = Math.max(0, rowCount - 1);

  for (let i = 0; i < extraRows; i++) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertTableRow: {
              tableCellLocation: {
                tableStartLocation: { index: tableStartIndex },
                rowIndex: templateRowIndex + i,
                columnIndex: 0,
              },
              insertBelow: true,
            },
          },
        ],
      },
    });
  }

  const refreshed = await docs.documents.get({ documentId });
  const tableEl = (refreshed.data.body?.content ?? []).find(
    (el) => el.startIndex === tableStartIndex && el.table
  );
  const table = tableEl?.table;
  if (!table?.tableRows) return true;

  const requests: docs_v1.Schema$Request[] = [];

  for (let i = rowCount - 1; i >= 0; i--) {
    const row = table.tableRows[templateRowIndex + i];
    const cells = row?.tableCells ?? [];
    const line = lines[i];
    if (!line) continue;

    const values: { col: number; text: string }[] = [];
    if (columns.authorization >= 0) values.push({ col: columns.authorization, text: line.authorization });
    if (columns.serviceCode >= 0) values.push({ col: columns.serviceCode, text: line.serviceCode });
    if (columns.description >= 0) {
      values.push({
        col: columns.description,
        text: truncateIjpLineDescription(line.description),
      });
    }
    if (columns.serviceDate >= 0) values.push({ col: columns.serviceDate, text: line.serviceDate });
    if (columns.startTime >= 0) values.push({ col: columns.startTime, text: line.startTime });
    if (columns.endTime >= 0) values.push({ col: columns.endTime, text: line.endTime });
    if (columns.hours >= 0) values.push({ col: columns.hours, text: line.hours.toFixed(1) });
    if (columns.amount >= 0) {
      values.push({ col: columns.amount, text: formatIjpInvoiceAmount(line.amountCents) });
    }
    if (columns.instructor >= 0) values.push({ col: columns.instructor, text: line.instructorName });

    values
      .filter((v) => v.col >= 0 && v.col < cells.length)
      .sort((a, b) => (cells[b.col]?.endIndex ?? 0) - (cells[a.col]?.endIndex ?? 0))
      .forEach((v) => {
        const cell = cells[v.col];
        if (cell) requests.push(...cellRewriteRequests(cell, v.text));
      });
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  const clearTags = Object.entries(
    Object.fromEntries(LINE_TAGS.map((t) => [t, ""]))
  ).map(([key, value]) => ({
    replaceAllText: {
      containsText: { text: `{{${key}}}`, matchCase: false },
      replaceText: value,
    },
  }));

  if (clearTags.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: clearTags },
    });
  }

  return true;
}
