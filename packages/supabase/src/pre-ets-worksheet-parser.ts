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
  /** Base school name for district roster (without group designation). */
  schoolName: string;
  /** Program group label within the school (e.g. Self Contained, Group 1). */
  groupName: string;
  groupDesignation: string | null;
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
    skippedMissingPidCount: number;
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
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (/^,+$/u.test(trimmed)) return true;
  return parseCsvLine(line).every((cell) => !cell.trim());
}

/** Stable key for matching the same spreadsheet group header across uploads. */
export function normalizeWorksheetHeaderKey(headerRaw: string): string {
  return headerRaw.replace(/\u00a0/g, " ").toLowerCase().replace(/\s+/g, " ").trim();
}

/** First non-empty CSV cell (billing exports pad rows with trailing commas). */
export function primaryCsvLabel(line: string): string {
  const cells = parseCsvLine(line);
  const first = cells.find((c) => c.trim().length > 0);
  return (first ?? line).replace(/\u00a0/g, " ").trim();
}

function isSupervisorLine(line: string): boolean {
  return /^\s*supervisor\s*:/i.test(primaryCsvLabel(line));
}

function isSummaryTotalLine(line: string): boolean {
  const label = primaryCsvLabel(line).toLowerCase();
  return label === "total" || label.startsWith("total ");
}

function isPreEtsTitleLine(line: string): boolean {
  const lower = primaryCsvLabel(line).toLowerCase();
  return /joshua\s+tree/.test(lower) && /pre-?ets/.test(lower);
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return joined.includes("student name") && joined.includes("pid");
}

function normalizeSchoolYear(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const compact = raw.replace(/\s+/g, "");
  const short = compact.match(/^(\d{4})-(\d{2})$/);
  if (short) {
    const start = Number.parseInt(short[1] ?? "", 10);
    const endSuffix = Number.parseInt(short[2] ?? "", 10);
    if (Number.isFinite(start) && Number.isFinite(endSuffix)) {
      const end = endSuffix < 100 ? start + 1 : endSuffix;
      return `${start}-${end}`;
    }
  }
  const long = compact.match(/^(\d{4})-(\d{4})$/);
  if (long) return compact;
  return compact || null;
}

function parseTitleLine(line: string): {
  monthLabel: string | null;
  schoolYear: string | null;
} {
  const normalized = line.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const yearMatch = normalized.match(/(\d{4}\s*[-–]\s*\d{2,4}|\d{4}-\d{4}|\d{4}-\d{2})/i);
  const schoolYear = normalizeSchoolYear(yearMatch?.[1] ?? null);

  let monthMatch = normalized.match(
    /(?:emsgi\s*\/\s*)?joshua\s+tree(?:\s+service\s+group)?\s+(.+?)\s+pre-?ets\s+(?:worksheet|billing)/i
  );
  if (!monthMatch) {
    monthMatch = normalized.match(
      /(?:emsgi\s*\/\s*)?joshua\s+tree(?:\s+service\s+group)?\s+([a-z]+)\s+pre-?ets\b/i
    );
  }
  if (!monthMatch) {
    return { monthLabel: null, schoolYear };
  }

  let monthLabel = monthMatch[1]?.trim() ?? null;
  if (monthLabel) {
    monthLabel = monthLabel.replace(/\s+\d{4}\s*[-–]\s*\d{2,4}$/i, "").trim();
  }

  return { monthLabel: monthLabel || null, schoolYear };
}

function parseDistrictLine(line: string): string | null {
  const match = primaryCsvLabel(line).match(/district\s+(\d+)\s+schools/i);
  return match?.[1] ?? null;
}

const GROUP_DESIGNATION_HINT =
  /^(inclusion|self\s*contained|resource|co-?teach|main|n\/a)$/i;

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

const FREQUENCY_ALIASES: Record<string, string> = {
  weekly: "WEEKLY",
  biweekly: "BIWEEKLY",
  "bi-weekly": "BIWEEKLY",
  "bi weekly": "BIWEEKLY",
  monthly: "MONTHLY",
  ft: "FT",
};

function normalizeFrequencyToken(token: string): string | null {
  const key = token.trim().toLowerCase().replace(/\s+/g, " ");
  return FREQUENCY_ALIASES[key] ?? null;
}

const WEEKDAY_HINT = /^(mon|tues?|wednes?|thurs?|fri)days?$/i;

function isWeekdayPart(part: string): boolean {
  return WEEKDAY_HINT.test(part.trim().toLowerCase());
}

function isGroupDesignationPart(part: string): boolean {
  const lower = part.trim().toLowerCase();
  if (!lower) return false;
  if (GROUP_DESIGNATION_HINT.test(lower)) return true;
  if (/^inclusion\b/.test(lower)) return true;
  if (/^self\s*cont(ained)?\b/.test(lower)) return true;
  if (/^class\s+\d+/i.test(part)) return true;
  if (/period/i.test(part)) return true;
  return false;
}

function looksLikePersonName(part: string): boolean {
  const p = part.trim();
  if (!p) return false;
  if (isGroupDesignationPart(p) || normalizeFrequencyToken(p) || isWeekdayPart(p)) return false;
  if (/\([a-z\s]+county\)/i.test(p)) return true;
  const inclusionParen = p.match(/^(.+?)\s*\(inclusion\)\s*$/i);
  if (inclusionParen && inclusionParen[1]?.trim().split(/\s+/).length >= 2) return true;
  return p.split(/\s+/).filter(Boolean).length >= 2;
}

function isGroupSuffixPart(part: string): boolean {
  const p = part.trim();
  if (!p || p.includes("(")) return false;
  if (isGroupDesignationPart(p) || normalizeFrequencyToken(p) || isWeekdayPart(p)) return false;
  if (looksLikePersonName(p)) return false;
  return p.split(/\s+/).length === 1 && /^[A-Za-z'.-]+$/.test(p);
}

type HeaderSegmentKind = "freq" | "day" | "group" | "person" | "suffix";

function classifyHeaderSegment(part: string): HeaderSegmentKind {
  if (normalizeFrequencyToken(part)) return "freq";
  if (isWeekdayPart(part)) return "day";
  if (isGroupDesignationPart(part)) return "group";
  if (looksLikePersonName(part)) return "person";
  if (isGroupSuffixPart(part)) return "suffix";
  if (part.trim().split(/\s+/).length >= 2) return "person";
  return "suffix";
}

function splitInstructorPart(part: string): { instructorName: string; groupHint: string | null } {
  const inclusionParen = part.match(/^(.+?)\s*\(inclusion\)\s*$/i);
  if (inclusionParen) {
    return { instructorName: inclusionParen[1]?.trim() ?? part, groupHint: "INCLUSION" };
  }
  return { instructorName: part.trim(), groupHint: null };
}

export function parseGroupHeader(headerRaw: string): {
  schoolName: string;
  groupName: string;
  groupDesignation: string | null;
  frequency: string | null;
  instructorName: string | null;
} {
  const trimmed = headerRaw.trim();
  const parts = trimmed.split("-").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) {
    return {
      schoolName: trimmed,
      groupName: "Main",
      groupDesignation: null,
      frequency: null,
      instructorName: null,
    };
  }

  const schoolName = parts[0] ?? trimmed;
  const segments = parts.slice(1).map((part) => ({ part, kind: classifyHeaderSegment(part) }));

  let frequency: string | null = null;
  for (const seg of segments) {
    if (seg.kind === "freq") {
      frequency = normalizeFrequencyToken(seg.part) ?? frequency;
    }
  }

  const personSeg = segments.find((s) => s.kind === "person");
  let instructorName: string | null = null;
  const groupParts: string[] = [];

  if (personSeg) {
    const split = splitInstructorPart(personSeg.part);
    instructorName = split.instructorName || null;
    if (split.groupHint) groupParts.push(split.groupHint);
  }

  for (const seg of segments) {
    if (seg.kind === "group" || seg.kind === "suffix") {
      groupParts.push(seg.part);
    }
  }

  const groupDesignation =
    groupParts.length > 0 ? groupParts.join(" - ").replace(/\s+-\s*$/u, "").trim() : null;

  return {
    schoolName,
    groupName: groupDesignation || "Main",
    groupDesignation,
    frequency,
    instructorName,
  };
}

function columnIndex(headers: string[], ...candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const needle = c.toLowerCase();
    const exact = lower.findIndex((h) => h === needle);
    if (exact >= 0) return exact;
    const idx = lower.findIndex((h) => h.includes(needle));
    if (idx >= 0) return idx;
  }
  return -1;
}

/** Prefer the primary Service column when legacy Service 2/3 columns exist. */
function columnIndexPrimaryService(headers: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const exact = lower.findIndex((h) => h === "service");
  if (exact >= 0) return exact;
  return lower.findIndex(
    (h) => h.startsWith("service") && !h.includes("2") && !h.includes("3")
  );
}

/** Prefer the primary Code column paired with Service (not Service 2/3 codes). */
const REQUIRED_WORKSHEET_COLUMNS = [
  { key: "student name", label: "Student Name" },
  { key: "pid", label: "PID #" },
] as const;

const RECOMMENDED_WORKSHEET_COLUMNS = [
  { key: "a & i", label: "A & I", alt: "a&i" },
  { key: "service", label: "Service" },
  { key: "code", label: "Code" },
  { key: "units", label: "Units" },
] as const;

/** Flag missing or ambiguous column headers on a student table row. */
export function validateWorksheetHeaderColumns(headers: string[], rowNumber: number): string[] {
  const issues: string[] = [];
  for (const col of REQUIRED_WORKSHEET_COLUMNS) {
    if (columnIndex(headers, col.key) < 0) {
      issues.push(`Row ${rowNumber}: missing required column "${col.label}"`);
    }
  }
  for (const col of RECOMMENDED_WORKSHEET_COLUMNS) {
    const alt = "alt" in col ? col.alt : undefined;
    const keys = alt ? [col.key, alt] : [col.key];
    if (columnIndex(headers, ...keys) < 0) {
      issues.push(`Row ${rowNumber}: could not find column "${col.label}" — check spreadsheet layout`);
    }
  }
  const classTimeIdx = columnIndex(headers, "class time");
  if (classTimeIdx < 0) {
    issues.push(`Row ${rowNumber}: no "Class Time" column — class times will be left blank`);
  }
  return issues;
}

function columnIndexPrimaryCode(headers: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim());
  const serviceIdx = columnIndexPrimaryService(headers);
  if (serviceIdx >= 0) {
    for (let i = serviceIdx + 1; i < lower.length; i++) {
      const h = lower[i] ?? "";
      if (h === "code") return i;
      if (h.startsWith("service")) break;
    }
  }
  const exact = lower.findIndex((h) => h === "code");
  if (exact >= 0) return exact;
  return lower.findIndex((h) => h.startsWith("code") && !h.includes("2") && !h.includes("3"));
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
    service: columnIndexPrimaryService(headers),
    code: columnIndexPrimaryCode(headers),
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

    if (rowNum === 1 || (!titleLine && isPreEtsTitleLine(line))) {
      titleLine = primaryCsvLabel(line);
      const parsed = parseTitleLine(titleLine);
      monthLabel = parsed.monthLabel;
      schoolYear = parsed.schoolYear;
      if (!monthLabel) issues.push(`Row ${rowNum}: could not parse month from title`);
      if (!schoolYear) issues.push(`Row ${rowNum}: could not parse school year from title`);
      continue;
    }

    if (rowNum === 2 || (!districtLine && /district\s+\d+/i.test(primaryCsvLabel(line)))) {
      districtLine = primaryCsvLabel(line);
      districtNumber = parseDistrictLine(districtLine);
      if (!districtNumber) issues.push(`Row ${rowNum}: could not parse GVRA district number`);
      continue;
    }

    if (isHeaderRow(cells)) {
      currentHeaders = cells;
      issues.push(...validateWorksheetHeaderColumns(cells, rowNum));
      continue;
    }

    if (currentHeaders && currentGroup) {
      const student = parseStudentRow(cells, currentHeaders, rowNum, options);
      if (student.notApproved) {
        issues.push(`Row ${rowNum}: NOT APPROVED — skipped`);
      } else if (student.studentName || student.participantId) {
        if (!student.participantId.trim()) {
          issues.push(`Row ${rowNum}: skipped — missing PID #${student.studentName ? ` (${student.studentName})` : ""}`);
        } else {
          currentGroup.students.push(student);
          if (!currentGroup.classTime && student.classTime?.trim()) {
            currentGroup.classTime = student.classTime.trim();
          }
          if (!currentGroup.serviceCode && student.serviceCode) {
            currentGroup.serviceCode = student.serviceCode;
          }
          if (!currentGroup.serviceLabel && student.service) {
            currentGroup.serviceLabel = student.service;
          }
        }
      }
      continue;
    }

    if (isSupervisorLine(line)) {
      continue;
    }

    if (isSummaryTotalLine(line)) {
      currentHeaders = null;
      continue;
    }

    const officeLabel = primaryCsvLabel(line).toLowerCase();
    if (officeLabel.includes("office") && officeLabel.includes("school")) {
      currentOffice = { name: primaryCsvLabel(line), groups: [] };
      offices.push(currentOffice);
      currentGroup = null;
      currentHeaders = null;
      continue;
    }

    if (!currentOffice) {
      currentOffice = { name: "Default Office", groups: [] };
      offices.push(currentOffice);
    }

    const headerRaw = primaryCsvLabel(line);
    if (!headerRaw) continue;
    const { schoolName, groupName, groupDesignation, frequency, instructorName } =
      parseGroupHeader(headerRaw);
    currentGroup = {
      headerRaw,
      schoolName,
      groupName,
      groupDesignation,
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
  let skippedMissingPidCount = 0;
  let groupCount = 0;
  for (const issue of issues) {
    if (issue.includes("skipped — missing PID")) skippedMissingPidCount++;
  }
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
      skippedMissingPidCount,
    },
  };
}
