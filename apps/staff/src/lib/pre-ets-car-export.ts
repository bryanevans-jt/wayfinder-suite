import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import {
  fillGoogleDocTemplatePdf,
  loadPreEtsSignatureTempFolderId,
} from "@/lib/pre-ets-google-doc";

export type CarPdfInput = {
  sessionDate: string | null;
  schoolName: string;
  authNumber: string;
  instructorName: string;
  serviceCode: string;
  lessonTopic: string | null;
  learningObjective: string | null;
  lessonStructure: string | null;
  participantCount: number | null;
  studentsOnTime: boolean | null;
  studentsEngaged: boolean | null;
  studentsParticipated: boolean | null;
  studentsDisruptive: boolean | null;
  facultyPresent: boolean | null;
  additionalNotes: string | null;
  signatureData: string | null;
  signedDate: string | null;
};

const CHECKED = "☑";
const UNCHECKED = "☐";

/** Renders "Yes ☑  No ☐" (or inverse) for the completed CAR Google Doc. */
export function yesNoCheckboxes(value: boolean | null): string {
  if (value === true) return `Yes ${CHECKED}  No ${UNCHECKED}`;
  if (value === false) return `Yes ${UNCHECKED}  No ${CHECKED}`;
  return `Yes ${UNCHECKED}  No ${UNCHECKED}`;
}

function checkboxMark(selected: boolean): string {
  return selected ? CHECKED : UNCHECKED;
}

/** Blank notes → empty string so {{AdditionalNotes}} disappears from the PDF. */
export function additionalNotesPlaceholder(notes: string | null | undefined): string {
  return (notes ?? "").trim();
}

/**
 * Full Additional Note(s) block for the template. Empty when blank so the
 * heading and tag do not appear on the finished document.
 */
export function additionalNotesSectionPlaceholder(notes: string | null | undefined): string {
  const trimmed = additionalNotesPlaceholder(notes);
  if (!trimmed) return "";
  return `Additional Note(s):\n${trimmed}`;
}

/** Format YYYY-MM-DD for the signed-date field on the CAR. */
export function formatCarSignedDate(isoDate: string | null | undefined): string {
  const raw = (isoDate ?? "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return raw;
  const [, y, m, d] = match;
  return `${m}/${d}/${y}`;
}

export function carPdfPlaceholders(input: CarPdfInput): Record<string, string> {
  const notes = additionalNotesPlaceholder(input.additionalNotes);
  const signedDate = formatCarSignedDate(input.signedDate);

  return {
    SessionDate: input.sessionDate ?? "",
    SchoolName: input.schoolName,
    AuthNumber: input.authNumber,
    InstructorName: input.instructorName,
    Topic: input.lessonTopic ?? "",
    LessonTopic: input.lessonTopic ?? "",
    ServiceCode: input.serviceCode,
    LearningObjective: input.learningObjective ?? "",
    LessonStructure: input.lessonStructure ?? "",
    ParticipantCount:
      input.participantCount === null || input.participantCount === undefined
        ? ""
        : String(input.participantCount),
    NumberOfParticipants:
      input.participantCount === null || input.participantCount === undefined
        ? ""
        : String(input.participantCount),
    StudentsOnTime: yesNoCheckboxes(input.studentsOnTime),
    StudentsEngaged: yesNoCheckboxes(input.studentsEngaged),
    StudentsParticipated: yesNoCheckboxes(input.studentsParticipated),
    StudentsDisruptive: yesNoCheckboxes(input.studentsDisruptive),
    FacultyPresent: yesNoCheckboxes(input.facultyPresent),
    StudentsOnTimeYes: checkboxMark(input.studentsOnTime === true),
    StudentsOnTimeNo: checkboxMark(input.studentsOnTime === false),
    StudentsEngagedYes: checkboxMark(input.studentsEngaged === true),
    StudentsEngagedNo: checkboxMark(input.studentsEngaged === false),
    StudentsParticipatedYes: checkboxMark(input.studentsParticipated === true),
    StudentsParticipatedNo: checkboxMark(input.studentsParticipated === false),
    StudentsDisruptiveYes: checkboxMark(input.studentsDisruptive === true),
    StudentsDisruptiveNo: checkboxMark(input.studentsDisruptive === false),
    FacultyPresentYes: checkboxMark(input.facultyPresent === true),
    FacultyPresentNo: checkboxMark(input.facultyPresent === false),
    AdditionalNotes: notes,
    AdditionalNotesSection: additionalNotesSectionPlaceholder(input.additionalNotes),
    SignedDate: signedDate,
    SignatureDate: signedDate,
  };
}

export async function buildPreEtsCarPdf(
  input: CarPdfInput,
  settings: Pick<PreEtsSettingsRow, "template_car_doc_id">,
  admin?: SupabaseClient
): Promise<Uint8Array> {
  const templateId = settings.template_car_doc_id;
  if (!templateId) {
    throw new Error("CAR Google Doc template is not configured in Pre-ETS settings.");
  }

  const signatureData =
    input.signatureData?.startsWith("data:image/") ? input.signatureData : null;

  const images = signatureData
    ? [
        { tag: "InstructorSignature", dataUrl: signatureData },
        { tag: "Signature", dataUrl: signatureData },
      ]
    : [];

  const signatureFolderId = admin
    ? await loadPreEtsSignatureTempFolderId(admin)
    : null;

  return fillGoogleDocTemplatePdf(
    templateId,
    carPdfPlaceholders(input),
    `Pre-ETS CAR ${input.sessionDate ?? "session"}`,
    {
      images,
      signatureFolderId,
    }
  );
}
