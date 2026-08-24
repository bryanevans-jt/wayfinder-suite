import { classifyPreEtsAuthorizationType, sanitizePreEtsServiceCodeText } from "./pre-ets-settings";

export const WORKSHEET_STUDENT_COLUMNS = [
  "#",
  "Student Name",
  "PID #",
  "A & I",
  "Service",
  "Code",
  "Units",
  "Class Time",
  "Invoice #",
  "Billed",
] as const;

export type ParsedWorksheetStudent = {
  rowNumber: number;
  listOrder: number;
  studentName: string;
  participantId: string;
  authNumber: string;
  service: string;
  serviceCode: string;
  units: number;
  classTime: string;
  invoiceNumber: string;
  billed: string;
  notApproved: boolean;
  authType: "group" | "individual" | "pending" | "skipped";
  issues: string[];
};

export type ParsedWorksheetGroup = {
  headerRaw: string;
  groupName: string;
  frequency: string | null;
  instructorName: string | null;
  classTime: string | null;
  serviceCode: string | null;
  serviceLabel: string | null;
  students: ParsedWorksheetStudent[];
};

export type ParsedWorksheetOffice = {
  name: string;
  groups: ParsedWorksheetGroup[];
};

export type ParsedDistrictWorksheet = {
  titleLine: string | null;
  monthLabel: string | null;
  schoolYear: string | null;
  serviceMonth: string | null;
  districtLine: string | null;
  districtNumber: string | null;
  offices: ParsedWorksheetOffice[];
  issues: string[];
  stats: {
    officeCount: number;
    groupCount: number;
    studentCount: number;
    notApprovedCount: number;
  };
};

export type ParseWorksheetOptions = {
  notApprovedMarker?: string;
  groupAuthDigitCount?: number;
};

function normalizeCell(value: string): string {
  return value.replace(/\u00a0/g, " ").trim();
}

/** Parse a single CSV line respecting quoted fields. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(normalizeCell(current));
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(normalizeCell(current));
  return cells;
}

function isBlankLine(line: string): boolean {
  return line.trim().length === 0;
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return joined.includes("student name") && joined.includes("pid");
}

function parseTitleLine(line: string): {
  monthLabel: string | null;
  schoolYear: string | null;
} {
  const match = line.match(
    /joshua\s+tree\s+(.+?)\s+pre-ets\s+worksheet\s+(\d{4}\s*[-–]\s*\d{4}|\d{4}-\d{4})/i
  );
  if (!match) {
    return { monthLabel: null, schoolYear: null };
  }
  return {
    monthLabel: match[1]?.trim() ?? null,
    schoolYear: match[2]?.replace(/\s+/g, "") ?? null,
  };
}

function parseDistrictLine(line: string): string | null {
  const match = line.match(/district\s+(\d+)\s+schools/i);
  return match?.[1] ?? null;
}

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

export function inferServiceMonth(
  monthLabel: string | null,
  schoolYear: string | null
): string | null {
  if (!monthLabel || !schoolYear) return null;
  const monthNum = MONTH_MAP[monthLabel.toLowerCase().replace(/\./g, "")];
  if (!monthNum) return null;
  const startYear = Number.parseInt(schoolYear.split("-")[0] ?? "", 10);
  if (!Number.isFinite(startYear)) return null;
  const year = monthNum >= 8 ? startYear : startYear + 1;
  return `${year}-${String(monthNum).padStart(2, "0")}-01`;
}

export function parseGroupHeader(headerRaw: string): {
  groupName: string;
  frequency: string | null;
  instructorName: string | null;
} {
  const trimmed = headerRaw.trim();
  const parts = trimmed.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return { groupName: trimmed, frequency: null, instructorName: null };
  }
  const instructorName = parts.pop() ?? null;
  const frequency = parts.pop() ?? null;
  const groupName = parts.join(" - ").trim() || trimmed;
  return { groupName, frequency, instructorName };
}

function columnIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase());
  for (const c of candidates) {
    const idx = lower.findIndex((h) => h === c.toLowerCase() || h.includes(c.toLowerCase()));
    if (idx >= 0) return idx;
  }
  return -1;
}

function parseStudentRow(
  cells: string[],
  headers: string[],
  rowNumber: number,
  options: ParseWorksheetOptions
): ParsedWorksheetStudent {
  const notApprovedMarker = (options.notApprovedMarker ?? "NOT APPROVED").toUpperCase();
  const idx = {
    order: columnIndex(headers, "#"),
    name: columnIndex(headers, "student name"),
    pid: columnIndex(headers, "pid"),
    auth: columnIndex(headers, "a & i", "a&i"),
    service: columnIndex(headers, "service"),
    code: columnIndex(headers, "code"),
    units: columnIndex(headers, "units"),
    classTime: columnIndex(headers, "class time"),
    invoice: columnIndex(headers, "invoice"),
    billed: columnIndex(headers, "billed"),
  };

  const get = (i: number) => (i >= 0 && i < cells.length ? cells[i] : "");

  const participantId = get(idx.pid);
  const authNumber = get(idx.auth);
  const pidUpper = participantId.toUpperCase();
  const authUpper = authNumber.toUpperCase();
  const notApproved =
    pidUpper.includes(notApprovedMarker) ||
    authUpper.includes(notApprovedMarker) ||
    (pidUpper.includes("NOT") && authUpper.includes("APPROVED"));

  const issues: string[] = [];
  const studentName = get(idx.name);
  if (!notApproved && !studentName) issues.push("Missing student name");

  let authType: ParsedWorksheetStudent["authType"] = "pending";
  if (notApproved) {
    authType = "skipped";
  } else if (authNumber) {
    const classified = classifyPreEtsAuthorizationType(
      authNumber,
      options.groupAuthDigitCount ?? 5
    );
    authType = classified === "unknown" ? "pending" : classified;
  }

  const unitsRaw = get(idx.units);
  const units = Number.parseInt(unitsRaw.replace(/[^\d]/g, ""), 10);

  return {
    rowNumber,
    listOrder: Number.parseInt(get(idx.order).replace(/[^\d]/g, ""), 10) || rowNumber,
    studentName,
    participantId,
    authNumber,
    service: get(idx.service),
    serviceCode: sanitizePreEtsServiceCodeText(get(idx.code)),
    units: Number.isFinite(units) ? units : 0,
    classTime: get(idx.classTime),
    invoiceNumber: get(idx.invoice),
    billed: get(idx.billed),
    notApproved,
    authType,
    issues,
  };
}

export function parseDistrictWorksheet(
  rawText: string,
  options: ParseWorksheetOptions = {}
): ParsedDistrictWorksheet {
  const lines = rawText.split(/\r?\n/);
  const issues: string[] = [];
  const offices: ParsedWorksheetOffice[] = [];

  let titleLine: string | null = null;
  let districtLine: string | null = null;
  let districtNumber: string | null = null;
  let monthLabel: string | null = null;
  let schoolYear: string | null = null;

  let currentOffice: ParsedWorksheetOffice | null = null;
  let currentGroup: ParsedWorksheetGroup | null = null;
  let currentHeaders: string[] | null = null;
  let blankRun = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    const rowNum = i + 1;

    if (isBlankLine(line)) {
      blankRun++;
      if (blankRun >= 2) {
        currentGroup = null;
        currentHeaders = null;
      }
      continue;
    }
    blankRun = 0;

    const cells = parseCsvLine(line);

    if (rowNum === 1 || (!titleLine && /joshua\s+tree/i.test(line))) {
      titleLine = line.trim();
      const parsed = parseTitleLine(titleLine);
      monthLabel = parsed.monthLabel;
      schoolYear = parsed.schoolYear;
      if (!monthLabel) issues.push(`Row ${rowNum}: could not parse month from title`);
      if (!schoolYear) issues.push(`Row ${rowNum}: could not parse school year from title`);
      continue;
    }

    if (rowNum === 2 || (!districtLine && /district\s+\d+/i.test(line))) {
      districtLine = line.trim();
      districtNumber = parseDistrictLine(districtLine);
      if (!districtNumber) issues.push(`Row ${rowNum}: could not parse GVRA district number`);
      continue;
    }

    if (isHeaderRow(cells)) {
      currentHeaders = cells;
      continue;
    }

    if (currentHeaders && currentGroup) {
      const student = parseStudentRow(cells, currentHeaders, rowNum, options);
      if (student.notApproved) {
        issues.push(`Row ${rowNum}: NOT APPROVED — skipped`);
      } else if (student.studentName || student.participantId) {
        currentGroup.students.push(student);
        if (!currentGroup.classTime && student.classTime) {
          currentGroup.classTime = student.classTime;
        }
        if (!currentGroup.serviceCode && student.serviceCode) {
          currentGroup.serviceCode = student.serviceCode;
        }
        if (!currentGroup.serviceLabel && student.service) {
          currentGroup.serviceLabel = student.service;
        }
      }
      continue;
    }

    const lower = line.toLowerCase();
    if (lower.includes("office") && lower.includes("school")) {
      currentOffice = { name: line.trim(), groups: [] };
      offices.push(currentOffice);
      currentGroup = null;
      currentHeaders = null;
      continue;
    }

    if (!currentOffice) {
      currentOffice = { name: "Default Office", groups: [] };
      offices.push(currentOffice);
    }

    const headerRaw = line.trim();
    const { groupName, frequency, instructorName } = parseGroupHeader(headerRaw);
    currentGroup = {
      headerRaw,
      groupName,
      frequency,
      instructorName,
      classTime: null,
      serviceCode: null,
      serviceLabel: null,
      students: [],
    };
    currentOffice.groups.push(currentGroup);
    currentHeaders = null;
  }

  let studentCount = 0;
  let notApprovedCount = 0;
  let groupCount = 0;
  for (const office of offices) {
    groupCount += office.groups.length;
    for (const group of office.groups) {
      studentCount += group.students.length;
      notApprovedCount += group.students.filter((s) => s.notApproved).length;
    }
  }

  const serviceMonth = inferServiceMonth(monthLabel, schoolYear);

  return {
    titleLine,
    monthLabel,
    schoolYear,
    serviceMonth,
    districtLine,
    districtNumber,
    offices,
    issues,
    stats: {
      officeCount: offices.length,
      groupCount,
      studentCount,
      notApprovedCount,
    },
  };
}
