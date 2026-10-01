import { expandSchoolAbbreviation } from "./pre-ets-school-name-match";

/** Billing exports that omit "High School" — match the worksheet label, not only class setup spelling. */
const WORKSHEET_SCHOOL_CANONICAL: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^upson\s*[-]?\s*lee(\s+high(\s+school)?|\s+school)?$/i, canonical: "Upson Lee High School" },
  { pattern: /^pike\s+county(\s+high(\s+school)?|\s+school)?$/i, canonical: "Pike County High School" },
  { pattern: /^northgate(\s+high(\s+school)?|\s+school)?$/i, canonical: "Northgate High School" },
  {
    pattern: /^project\s+united(\s+high(\s+school)?|\s+school)?$/i,
    canonical: "Project United",
  },
  {
    pattern: /^scintilla\s+charter\s+school(\s+[a-z][a-z\s.'-]+)?$/i,
    canonical: "Scintilla Charter School",
  },
];

const KNOWN_SCHOOL_LABEL_PATTERNS: RegExp[] = [
  /\bupson\s*[-]?\s*lee\b/i,
  /\bpike\s+county\b/i,
  /\bnorthgate\b/i,
  /\bproject\s+united\b/i,
  /\bscintilla\s+charter\s+school\b/i,
  /\bcharter\s+school\b/i,
  /** Alternate Pre-ETS sites billed like schools but not named “___ High School”. */
  /^project\s+[a-z0-9]/i,
];

/** True when the label is a known school even without "High School" (e.g. "Upson Lee"). */
export function looksLikeKnownWorksheetSchoolLabel(label: string): boolean {
  const normalized = label.replace(/\u00a0/g, " ").trim();
  if (normalized.length < 8) return false;
  if (KNOWN_SCHOOL_LABEL_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  for (const { pattern } of WORKSHEET_SCHOOL_CANONICAL) {
    if (pattern.test(normalized)) return true;
  }
  return false;
}

/** Map worksheet header school segment to class-setup / pre_ets_schools naming. */
function stripCharterSchoolCampusSuffix(name: string): string {
  const match = name.match(/^(.+\bcharter\s+school)\s+([a-z][a-z\s.'-]+)$/i);
  if (!match?.[1]) return name;
  const campus = match[2]?.trim().toLowerCase() ?? "";
  if (/^(high|middle|elementary|school)$/i.test(campus)) return name;
  return match[1].trim();
}

export function canonicalizeWorksheetSchoolName(name: string): string {
  let trimmed = name.replace(/\u00a0/g, " ").trim();
  for (const { pattern, canonical } of WORKSHEET_SCHOOL_CANONICAL) {
    if (pattern.test(trimmed)) return canonical;
  }
  trimmed = stripCharterSchoolCampusSuffix(trimmed);
  return expandSchoolAbbreviation(trimmed);
}
