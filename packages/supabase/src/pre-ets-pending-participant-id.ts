/** Placeholder PID prefix for worksheet rows with A&I but no PID # on the sheet. */
export const PRE_ETS_PENDING_PID_PREFIX = "PENDING-PID-";

export function isPreEtsPendingParticipantId(participantId: string | null | undefined): boolean {
  return (participantId ?? "").trim().startsWith(PRE_ETS_PENDING_PID_PREFIX);
}

/** Stable placeholder until staff enter the real PID in Edit roster. */
export function buildPreEtsPendingParticipantId(input: {
  schoolYear: string;
  studentName: string;
  rowNumber: number;
}): string {
  const year = input.schoolYear.trim() || "unknown";
  const slug = input.studentName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);
  const row = String(input.rowNumber);
  return `${PRE_ETS_PENDING_PID_PREFIX}${year}-${slug || "STUDENT"}-${row}`;
}
