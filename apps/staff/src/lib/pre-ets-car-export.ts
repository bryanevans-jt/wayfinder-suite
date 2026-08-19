import type { PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import { fillGoogleDocTemplatePdf } from "@/lib/pre-ets-google-doc";

export type CarPdfInput = {
  sessionDate: string | null;
  schoolName: string;
  authNumber: string;
  instructorName: string;
  serviceCode: string;
  lessonTopic: string | null;
  learningObjective: string | null;
  lessonStructure: string | null;
  studentsOnTime: boolean | null;
  studentsEngaged: boolean | null;
  studentsParticipated: boolean | null;
  studentsDisruptive: boolean | null;
  facultyPresent: boolean | null;
  additionalNotes: string | null;
};

function yesNo(value: boolean | null): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "";
}

export function carPdfPlaceholders(input: CarPdfInput): Record<string, string> {
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
    StudentsOnTime: yesNo(input.studentsOnTime),
    StudentsEngaged: yesNo(input.studentsEngaged),
    StudentsParticipated: yesNo(input.studentsParticipated),
    StudentsDisruptive: yesNo(input.studentsDisruptive),
    FacultyPresent: yesNo(input.facultyPresent),
    AdditionalNotes: input.additionalNotes ?? "",
  };
}

export async function buildPreEtsCarPdf(
  input: CarPdfInput,
  settings: Pick<PreEtsSettingsRow, "template_car_doc_id">
): Promise<Uint8Array> {
  const templateId = settings.template_car_doc_id;
  if (!templateId) {
    throw new Error("CAR Google Doc template is not configured in Pre-ETS settings.");
  }

  return fillGoogleDocTemplatePdf(
    templateId,
    carPdfPlaceholders(input),
    `Pre-ETS CAR ${input.sessionDate ?? "session"}`
  );
}
