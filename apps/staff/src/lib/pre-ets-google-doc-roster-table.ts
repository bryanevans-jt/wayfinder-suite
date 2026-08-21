import type { docs_v1 } from "googleapis";

export type RosterTableStudent = {
  participantId: string;
  fullName: string;
};

/** Split stored full name into first / last for roster columns. */
export function splitPreEtsStudentName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  if (!trimmed) return { firstName: "", lastName: "" };

  if (trimmed.includes(",")) {
    const [last, ...rest] = trimmed.split(",");
    return {
      lastName: last.trim(),
      firstName: rest.join(",").trim(),
    };
  }

  const parts = trimmed.split(" ");
  if (parts.length === 1) {
    return { firstName: "", lastName: parts[0] };
  }

  return {
    lastName: parts[parts.length - 1],
    firstName: parts.slice(0, -1).join(" "),
  };
}

type StructuralElement = docs_v1.Schema$StructuralElement;
type Table = docs_v1.Schema$Table;
type TableCell = docs_v1.Schema$TableCell;

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

function findRosterTable(content: StructuralElement[] | undefined): {
  tableStartIndex: number;
  table: Table;
  templateRowIndex: number;
  columns: {
    pid: number;
    lastName: number;
    firstName: number;
    fullName: number;
  };
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
        rowText.includes("{{PID}}") ||
        rowText.includes("{{ParticipantId}}") ||
        rowText.includes("{{StudentLastName}}") ||
        rowText.includes("{{StudentFirstName}}") ||
        rowText.includes("{{StudentName}}") ||
        rowText.includes("{{RosterRow}}");

      if (!looksLikeTemplate) continue;

      return {
        tableStartIndex,
        table,
        templateRowIndex: r,
        columns: {
          pid: findTagColumn(cells, ["PID", "ParticipantId"]),
          lastName: findTagColumn(cells, ["StudentLastName", "LastName"]),
          firstName: findTagColumn(cells, ["StudentFirstName", "FirstName"]),
          fullName: findTagColumn(cells, ["StudentName"]),
        },
      };
    }
  }

  return null;
}

function cellRewriteRequests(
  cell: TableCell,
  text: string
): docs_v1.Schema$Request[] {
  if (cell.startIndex == null || cell.endIndex == null) return [];
  const start = cell.startIndex;
  const end = cell.endIndex;
  const requests: docs_v1.Schema$Request[] = [];

  // Keep the cell's trailing structural newline (endIndex - 1).
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

/**
 * Expand a roster table that has one template data row with unnumbered tags
 * ({{PID}}, {{StudentLastName}}, {{StudentFirstName}}, optional {{StudentName}})
 * and fill one row per student. Signature / date columns are left blank.
 *
 * @returns true when a roster template table was found and processed
 */
export async function expandPreEtsRosterTableInDoc(
  docs: docs_v1.Docs,
  documentId: string,
  students: RosterTableStudent[]
): Promise<boolean> {
  const initial = await docs.documents.get({ documentId });
  const found = findRosterTable(initial.data.body?.content ?? undefined);
  if (!found) return false;

  const { tableStartIndex, templateRowIndex, columns } = found;
  const extraRows = Math.max(0, students.length - 1);

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

  // Re-read indices after row inserts.
  const refreshed = await docs.documents.get({ documentId });
  const tableEl = (refreshed.data.body?.content ?? []).find(
    (el) => el.startIndex === tableStartIndex && el.table
  );
  const table = tableEl?.table;
  if (!table?.tableRows) return true;

  const dataRowCount = Math.max(1, students.length);
  // Build rewrite requests from the bottom of the document upward so indices stay valid.
  const requests: docs_v1.Schema$Request[] = [];

  for (let i = dataRowCount - 1; i >= 0; i--) {
    const row = table.tableRows[templateRowIndex + i];
    const cells = row?.tableCells ?? [];
    const student = students[i];
    const names = student
      ? splitPreEtsStudentName(student.fullName)
      : { firstName: "", lastName: "" };

    const values: { col: number; text: string }[] = [];
    if (columns.pid >= 0) {
      values.push({ col: columns.pid, text: student?.participantId ?? "" });
    }
    if (columns.lastName >= 0) {
      values.push({ col: columns.lastName, text: names.lastName });
    }
    if (columns.firstName >= 0) {
      values.push({ col: columns.firstName, text: names.firstName });
    }
    if (columns.fullName >= 0) {
      values.push({ col: columns.fullName, text: student?.fullName ?? "" });
    }

    // Highest cell endIndex first within the row.
    values
      .filter((v) => v.col >= 0 && v.col < cells.length)
      .sort((a, b) => (cells[b.col]?.endIndex ?? 0) - (cells[a.col]?.endIndex ?? 0))
      .forEach((v) => {
        requests.push(...cellRewriteRequests(cells[v.col], v.text));
      });
  }

  // Clear a lone {{RosterRow}} marker if it lived in another column.
  for (let i = dataRowCount - 1; i >= 0; i--) {
    const cells = table.tableRows[templateRowIndex + i]?.tableCells ?? [];
    for (let c = cells.length - 1; c >= 0; c--) {
      if (
        c === columns.pid ||
        c === columns.lastName ||
        c === columns.firstName ||
        c === columns.fullName
      ) {
        continue;
      }
      const text = cellPlainText(cells[c]);
      if (text.includes("{{RosterRow}}")) {
        requests.push(...cellRewriteRequests(cells[c], ""));
      }
    }
  }

  if (requests.length > 0) {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
  }

  return true;
}

/** Tags that belong to the repeating roster row (not header fields). */
export const PRE_ETS_ROSTER_ROW_TAGS = [
  "PID",
  "ParticipantId",
  "StudentLastName",
  "LastName",
  "StudentFirstName",
  "FirstName",
  "StudentName",
  "RosterRow",
] as const;
