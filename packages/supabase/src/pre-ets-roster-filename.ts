const MONTH_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * School line on roster PDFs: "School - Group" unless the group is "Main" (any case).
 */
export function formatPreEtsRosterSchoolDisplayName(
  schoolName: string,
  groupName: string | null | undefined
): string {
  const school = schoolName.trim() || "School";
  const group = (groupName ?? "").trim();
  if (!group || /^main$/i.test(group)) {
    return school;
  }
  return `${school} - ${group}`;
}

export function sanitizePreEtsRosterFileNamePart(value: string): string {
  return value
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/** e.g. 2025-10-01 → "Oct 2025" */
export function formatPreEtsServiceMonthForFilename(
  serviceMonth: string | null | undefined
): string | null {
  if (!serviceMonth?.trim()) return null;
  const trimmed = serviceMonth.trim().slice(0, 10);
  const match = /^(\d{4})-(\d{2})/.exec(trimmed);
  if (!match) return sanitizePreEtsRosterFileNamePart(trimmed);
  const year = match[1];
  const monthNum = Number.parseInt(match[2], 10);
  if (monthNum >= 1 && monthNum <= 12) {
    return `${MONTH_SHORT[monthNum - 1]} ${year}`;
  }
  return `${year}-${match[2]}`;
}

export function formatPreEtsSessionDateForFilename(
  sessionDate: string | null | undefined
): string | null {
  if (!sessionDate?.trim()) return null;
  const d = sessionDate.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : sanitizePreEtsRosterFileNamePart(sessionDate);
}

export type PreEtsRosterFilenameParts = {
  schoolYear: string | null | undefined;
  serviceMonth: string | null | undefined;
  schoolName: string;
  groupName: string;
  sessionDate?: string | null | undefined;
};

/**
 * Download / ZIP name for roster PDFs:
 * `{School Year} {Month} - {School} - {Group}` plus ` - {YYYY-MM-DD}` when a session date is set.
 */
export function buildPreEtsRosterFileLabel(parts: PreEtsRosterFilenameParts): string {
  const school = sanitizePreEtsRosterFileNamePart(parts.schoolName || "School");
  const group = sanitizePreEtsRosterFileNamePart(parts.groupName || "Group");
  const monthPart = formatPreEtsServiceMonthForFilename(parts.serviceMonth);
  const yearPart = parts.schoolYear?.trim()
    ? sanitizePreEtsRosterFileNamePart(parts.schoolYear.trim())
    : null;
  const sessionPart = formatPreEtsSessionDateForFilename(parts.sessionDate);

  const prefix = [yearPart, monthPart].filter(Boolean).join(" ");
  const core = prefix ? `${prefix} - ${school} - ${group}` : `${school} - ${group}`;
  return sessionPart ? `${core} - ${sessionPart}` : core;
}

export function buildPreEtsRosterAttachmentFilename(fileLabel: string, maxLen = 180): string {
  return fileLabel.replace(/[^\w\s.-]/g, "").trim().slice(0, maxLen);
}
