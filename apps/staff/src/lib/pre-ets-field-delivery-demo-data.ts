/** Sample world for TS/TI roster delivery training (no database). */

export const FIELD_DEMO_SERVICE_MONTH = "2025-10";

export type FieldDemoStudent = {
  id: string;
  participantId: string;
  fullName: string;
};

export type FieldDemoSession = {
  id: string;
  sessionDate: string;
  schoolName: string;
  authNumber: string;
  serviceCode: string;
  serviceLabel: string;
  instructorName: string;
  status: "scheduled" | "completed";
};

export const FIELD_DEMO_AUTH = {
  id: "training-auth-peach",
  authNumber: "87654321",
  authType: "group",
  serviceCode: "PTS-001",
  serviceLabel: "Job Exploration Counseling",
  schoolName: "Peach County High School",
  groupName: "Self Contained",
  instructorName: "Felicia Smith",
  classTime: "Mondays 10:00 AM",
  serviceMonth: FIELD_DEMO_SERVICE_MONTH,
};

export const FIELD_DEMO_STUDENTS: FieldDemoStudent[] = [
  { id: "s1", participantId: "1001842", fullName: "Jordan Rivera" },
  { id: "s2", participantId: "1002198", fullName: "Maya Brooks" },
  { id: "s3", participantId: "1003301", fullName: "Devon Carter" },
  { id: "s4", participantId: "1004410", fullName: "Aisha Nguyen" },
];

export const FIELD_DEMO_SESSION: FieldDemoSession = {
  id: "training-session-1",
  sessionDate: "2025-10-06",
  schoolName: FIELD_DEMO_AUTH.schoolName,
  authNumber: FIELD_DEMO_AUTH.authNumber,
  serviceCode: FIELD_DEMO_AUTH.serviceCode,
  serviceLabel: FIELD_DEMO_AUTH.serviceLabel,
  instructorName: FIELD_DEMO_AUTH.instructorName,
  status: "scheduled",
};

export const FIELD_DEMO_CAR_QUESTIONS = [
  { key: "students_on_time" as const, label: "Did students arrive on time for the session?" },
  { key: "students_engaged" as const, label: "Were present students engaged in Pre-ETS activities?" },
  { key: "students_participated" as const, label: "Did all present students participate in activities?" },
  {
    key: "students_disruptive" as const,
    label: "Were there disruptive behaviors that affected instruction?",
  },
  { key: "faculty_present" as const, label: "Was school faculty or designated staff present as required?" },
];

export type FieldDemoTrainingStep = {
  id: number;
  title: string;
  summary: string;
  focus: "notification" | "authorizations" | "sessions" | "print-roster" | "print-plan" | "paper-sign" | "upload" | "attendance" | "car" | "complete";
};

export const FIELD_DEMO_TRAINING_STEPS: FieldDemoTrainingStep[] = [
  {
    id: 1,
    title: "Roster released",
    summary:
      "After Accounts enters the GVRA authorization number, you get a notification and the school appears under Rosters & auths and Sessions & reports.",
    focus: "notification",
  },
  {
    id: 2,
    title: "Confirm roster online",
    summary:
      "Open Rosters & auths to view the student list for your school. This matches the names that will print on the sign-in sheet.",
    focus: "authorizations",
  },
  {
    id: 3,
    title: "Open your session",
    summary:
      "Go to Sessions & reports and select the scheduled session for that school. All documentation happens from this screen.",
    focus: "sessions",
  },
  {
    id: 4,
    title: "Print roster PDF",
    summary:
      "Use Print roster PDF before class. Each student signs on paper next to their name (Participant ID + signature + date).",
    focus: "print-roster",
  },
  {
    id: 5,
    title: "Print Activity Plan",
    summary:
      "Use Print Activity Plan (Class Activity Report on paper). Bring it to class; you may also complete the same fields in the app after class.",
    focus: "print-plan",
  },
  {
    id: 6,
    title: "Collect signatures at school",
    summary:
      "Students sign the printed roster. You sign the instructor attestation at the bottom of the roster sheet.",
    focus: "paper-sign",
  },
  {
    id: 7,
    title: "Upload signed roster",
    summary:
      "Scan or photograph the signed roster as a PDF and upload it here. It is stored in the Pre-ETS Google Drive folder for Accounts.",
    focus: "upload",
  },
  {
    id: 8,
    title: "Mark attendance",
    summary:
      "Check Present for each student who signed the paper roster. Present = signed on roster in Wayfinder Pro.",
    focus: "attendance",
  },
  {
    id: 9,
    title: "Submit Class Activity Report (CAR)",
    summary:
      "Complete lesson fields, yes/no checkboxes, signed date, and draw your instructor signature in the app, then Submit CAR.",
    focus: "car",
  },
  {
    id: 10,
    title: "Documentation complete",
    summary:
      "When the signed roster is uploaded and the CAR is submitted, the session is marked complete and Accounts/supervisor are notified.",
    focus: "complete",
  },
];
