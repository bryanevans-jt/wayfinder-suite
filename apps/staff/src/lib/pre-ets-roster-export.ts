import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import { fillGoogleDocTemplatePdf } from "@/lib/pre-ets-google-doc";
import {
  generatePreEtsRosterPdf,
  type RosterPdfInput,
} from "@/lib/pre-ets-roster-pdf";

const MAX_ROSTER_TEMPLATE_ROWS = 30;

export function rosterPdfPlaceholders(input: RosterPdfInput): Record<string, string> {
  const placeholders: Record<string, string> = {
    AuthorizationNumber: input.authorizationNumber,
    AuthNumber: input.authorizationNumber,
    AuthType: input.authType === "individual" ? "Individual" : "Group",
    SessionDate: input.sessionDate ?? "",
    SchoolName: input.schoolName,
    InstructorName: input.instructorName,
    Topic: input.topic,
    ServiceCode: input.serviceCode,
    ServiceLabel: input.topic,
    StudentCount: String(input.students.length),
    StudentList: input.students.map((s) => `${s.participantId} — ${s.fullName}`).join("\n"),
  };

  for (let i = 0; i < MAX_ROSTER_TEMPLATE_ROWS; i++) {
    const student = input.students[i];
    const n = i + 1;
    placeholders[`StudentName${n}`] = student?.fullName ?? "";
    placeholders[`PID${n}`] = student?.participantId ?? "";
    placeholders[`ParticipantId${n}`] = student?.participantId ?? "";
  }

  return placeholders;
}

export async function buildPreEtsRosterPdf(
  input: RosterPdfInput,
  settings: Pick<PreEtsSettingsRow, "template_roster_doc_id" | "template_individual_roster_doc_id">
): Promise<Uint8Array> {
  const authType = input.authType ?? "group";
  const templateId =
    authType === "individual"
      ? settings.template_individual_roster_doc_id ?? settings.template_roster_doc_id
      : settings.template_roster_doc_id;

  if (templateId) {
    try {
      return await fillGoogleDocTemplatePdf(
        templateId,
        rosterPdfPlaceholders(input),
        `Pre-ETS Roster - ${input.schoolName}`
      );
    } catch {
      // Fall back to built-in pdf-lib roster when template copy/fill fails.
    }
  }

  return generatePreEtsRosterPdf(input);
}
