/**
 * Pre-ETS Google Doc and Drive path placeholder reference.
 * Use these exact tokens (with double curly braces) in template documents.
 */

export type PreEtsTemplatePlaceholder = {
  token: string;
  description: string;
};

export function formatPreEtsPlaceholderToken(token: string): string {
  return `{{${token}}}`;
}

/** Blank roster, individual roster, and session sign-in sheets — core fields. */
export const PRE_ETS_ROSTER_CORE_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  { token: "AuthorizationNumber", description: "GVRA authorization number" },
  { token: "AuthNumber", description: "Same as AuthorizationNumber (alias)" },
  { token: "AuthType", description: "Group or Individual" },
  { token: "SessionDate", description: "Session date (YYYY-MM-DD) when scheduled" },
  { token: "SchoolName", description: "School name" },
  { token: "InstructorName", description: "Primary instructor display name" },
  { token: "Topic", description: "Session topic / service label" },
  { token: "ServiceCode", description: "GVRA service code" },
  { token: "ServiceLabel", description: "Same as Topic (alias)" },
  { token: "StudentCount", description: "Number of students on the roster" },
  { token: "StudentList", description: "All students as PID — Full Name, one per line" },
];

export const PRE_ETS_ROSTER_ROW_PLACEHOLDER_NOTE =
  "Numbered row tokens StudentName1–30, PID1–30, and ParticipantId1–30 (alias of PIDn). Unused rows are left blank.";

/** Full roster placeholder list including all numbered row tokens. */
export const PRE_ETS_ROSTER_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  ...PRE_ETS_ROSTER_CORE_PLACEHOLDERS,
  ...Array.from({ length: 30 }, (_, i) => {
    const n = i + 1;
    return [
      {
        token: `StudentName${n}`,
        description: `Student ${n} full name (empty when fewer than ${n} students)`,
      },
      {
        token: `PID${n}`,
        description: `Student ${n} participant ID (empty when fewer than ${n} students)`,
      },
      {
        token: `ParticipantId${n}`,
        description: `Same as PID${n} (alias)`,
      },
    ];
  }).flat(),
];

/** Invoice cover sheet and attestation page. */
export const PRE_ETS_INVOICE_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  { token: "ProviderName", description: "Billing provider name (Joshua Tree Service Group)" },
  { token: "RemitAddress", description: "Remit-to mailing address" },
  { token: "SchoolName", description: "School name" },
  { token: "AuthNumber", description: "Authorization number" },
  { token: "AuthType", description: "Group or Individual" },
  { token: "InvoiceNumber", description: "Provider invoice number (when assigned)" },
  { token: "ServiceMonth", description: "Service month label (e.g. August 2025)" },
  { token: "ServiceCode", description: "GVRA service code" },
  { token: "ServiceLabel", description: "Service description / label" },
  { token: "RateDollars", description: "Rate per unit in dollars (e.g. 90.00)" },
  { token: "TotalUnits", description: "Billable units for the packet" },
  { token: "TotalAmount", description: "Total amount in dollars (e.g. 450.00)" },
];

/** Nested Google Drive folder path under each configured root folder. */
export const PRE_ETS_DRIVE_PATH_TOKENS: PreEtsTemplatePlaceholder[] = [
  { token: "SchoolYear", description: "School year from worksheet / settings (e.g. 2025-2026)" },
  {
    token: "District",
    description: "GVRA district from uploaded worksheet (e.g. District 5)",
  },
  { token: "School", description: "School name" },
  { token: "Month", description: "Service month (YYYY-MM)" },
  { token: "AuthNumber", description: "Authorization number (optional leaf folder)" },
];

export const PRE_ETS_DEFAULT_DRIVE_PATH_TEMPLATE =
  "{SchoolYear}/{District}/{School}/{Month}";

/** Class Activity Report — template export uses these tokens when configured. */
export const PRE_ETS_CAR_PLACEHOLDERS: PreEtsTemplatePlaceholder[] = [
  { token: "SessionDate", description: "Session date" },
  { token: "SchoolName", description: "School name" },
  { token: "AuthNumber", description: "Authorization number" },
  { token: "InstructorName", description: "Instructor display name" },
  { token: "Topic", description: "Lesson topic (alias of LessonTopic)" },
  { token: "LessonTopic", description: "Lesson topic" },
  { token: "ServiceCode", description: "GVRA service code" },
  { token: "LearningObjective", description: "Learning objective" },
  { token: "LessonStructure", description: "Lesson structure / activities" },
  {
    token: "ParticipantCount",
    description: "Number of participants (instructor-entered)",
  },
  {
    token: "NumberOfParticipants",
    description: "Same as ParticipantCount (alias)",
  },
  {
    token: "StudentsOnTime",
    description: 'Yes/No with checkboxes, e.g. "Yes ☑  No ☐"',
  },
  {
    token: "StudentsEngaged",
    description: 'Yes/No with checkboxes, e.g. "Yes ☑  No ☐"',
  },
  {
    token: "StudentsParticipated",
    description: 'Yes/No with checkboxes, e.g. "Yes ☑  No ☐"',
  },
  {
    token: "StudentsDisruptive",
    description: 'Yes/No with checkboxes, e.g. "Yes ☑  No ☐"',
  },
  {
    token: "FacultyPresent",
    description: 'Yes/No with checkboxes, e.g. "Yes ☑  No ☐"',
  },
  {
    token: "StudentsOnTimeYes",
    description: "☑ or ☐ for Yes only (pair with StudentsOnTimeNo)",
  },
  {
    token: "StudentsOnTimeNo",
    description: "☑ or ☐ for No only (pair with StudentsOnTimeYes)",
  },
  {
    token: "StudentsEngagedYes",
    description: "☑ or ☐ for Yes only",
  },
  {
    token: "StudentsEngagedNo",
    description: "☑ or ☐ for No only",
  },
  {
    token: "StudentsParticipatedYes",
    description: "☑ or ☐ for Yes only",
  },
  {
    token: "StudentsParticipatedNo",
    description: "☑ or ☐ for No only",
  },
  {
    token: "StudentsDisruptiveYes",
    description: "☑ or ☐ for Yes only",
  },
  {
    token: "StudentsDisruptiveNo",
    description: "☑ or ☐ for No only",
  },
  {
    token: "FacultyPresentYes",
    description: "☑ or ☐ for Yes only",
  },
  {
    token: "FacultyPresentNo",
    description: "☑ or ☐ for No only",
  },
  {
    token: "AdditionalNotes",
    description: "Additional notes text only; blank when empty (tag removed)",
  },
  {
    token: "AdditionalNotesSection",
    description:
      'Full "Additional Note(s): …" block; empty when blank so heading + tag are removed',
  },
  {
    token: "InstructorSignature",
    description: "Embedded instructor signature image (drawn on submit)",
  },
  {
    token: "Signature",
    description: "Same as InstructorSignature (alias)",
  },
  {
    token: "SignedDate",
    description: "Date the instructor signed (MM/DD/YYYY)",
  },
  {
    token: "SignatureDate",
    description: "Same as SignedDate (alias)",
  },
];
