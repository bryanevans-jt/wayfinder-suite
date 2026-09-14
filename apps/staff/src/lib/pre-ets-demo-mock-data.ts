export const DEMO_SERVICE_MONTH = "2025-10";
export const DEMO_SCHOOL_YEAR = "2025-2026";
export const DEMO_DISTRICT = "9";

export type DemoWorksheetImport = {
  id: string;
  file_name: string;
  phase: string;
  status: string;
  service_month: string;
  committed_at: string;
  school_groups: string[];
};

export type DemoAuthorization = {
  id: string;
  auth_number: string | null;
  auth_type: string;
  service_code: string;
  service_label: string;
  service_month: string;
  school_name: string;
  group_name: string;
  instructor_name: string;
  class_time: string;
  released: boolean;
};

export type DemoRosterStudent = {
  id: string;
  participantId: string;
  fullName: string;
  unitsApproved: number;
};

export type DemoPipelineRow = {
  schoolName: string;
  groupName: string;
  status: "awaiting_spreadsheet" | "pending_authorization" | "roster_submitted";
  studentCount: number;
  authNumber: string | null;
  instructorName: string;
};

export type DemoSession = {
  id: string;
  session_date: string;
  school_name: string;
  auth_number: string;
  status: string;
  has_signed_roster: boolean;
  has_car: boolean;
};

export type DemoNotification = {
  id: string;
  title: string;
  body: string;
  created_at: string;
};

export type DemoSnapshot = {
  step: number;
  worksheetImports: DemoWorksheetImport[];
  authorizations: DemoAuthorization[];
  rosters: Record<string, DemoRosterStudent[]>;
  pipeline: DemoPipelineRow[];
  sessions: DemoSession[];
  notifications: DemoNotification[];
  fieldBlocked: boolean;
  fieldMessage: string | null;
};

const VALDOSTA_ROSTER: DemoRosterStudent[] = [
  { id: "v1", participantId: "1001842", fullName: "Jordan Rivera", unitsApproved: 4 },
  { id: "v2", participantId: "1002198", fullName: "Maya Brooks", unitsApproved: 4 },
  { id: "v3", participantId: "1003301", fullName: "Devon Carter", unitsApproved: 4 },
  { id: "v4", participantId: "1004410", fullName: "Aisha Nguyen", unitsApproved: 4 },
];

const LOWNDES_ROSTER: DemoRosterStudent[] = [
  { id: "l1", participantId: "1005522", fullName: "Chris Palmer", unitsApproved: 4 },
  { id: "l2", participantId: "1006633", fullName: "Taylor Greene", unitsApproved: 4 },
  { id: "l3", participantId: "1007744", fullName: "Sam Ortiz", unitsApproved: 4 },
];

function valdostaAuth(released: boolean): DemoAuthorization {
  return {
    id: "demo-auth-valdosta",
    auth_number: released ? "87654321" : null,
    auth_type: released ? "group" : "pending",
    service_code: "PTS-001",
    service_label: "Job Exploration Counseling",
    service_month: DEMO_SERVICE_MONTH,
    school_name: "Valdosta High School",
    group_name: "Self Contained",
    instructor_name: "Madison Hewett",
    class_time: "Wednesdays 1:00 PM",
    released,
  };
}

function lowndesAuth(): DemoAuthorization {
  return {
    id: "demo-auth-lowndes",
    auth_number: null,
    auth_type: "pending",
    service_code: "PTS-001",
    service_label: "Job Exploration Counseling",
    service_month: DEMO_SERVICE_MONTH,
    school_name: "Lowndes High School",
    group_name: "Self Contained",
    instructor_name: "Madison Hewett",
    class_time: "Fridays 10:00 AM",
    released: false,
  };
}

/** Mock world state for each training step (1–5). */
export function getDemoSnapshot(step: number): DemoSnapshot {
  const s = Math.min(5, Math.max(1, step));
  const valdostaReleased = s >= 3;
  const hasLowndes = s >= 5;

  const worksheetImports: DemoWorksheetImport[] = [
    {
      id: "demo-import-1",
      file_name: `District_${DEMO_DISTRICT}_October_2025_planning.csv`,
      phase: "planning",
      status: "committed",
      service_month: DEMO_SERVICE_MONTH,
      committed_at: "2025-10-03T14:22:00Z",
      school_groups: hasLowndes
        ? ["Valdosta High School · Self Contained", "Lowndes High School · Self Contained"]
        : ["Valdosta High School · Self Contained"],
    },
  ];

  if (hasLowndes) {
    worksheetImports.push({
      id: "demo-import-2",
      file_name: `District_${DEMO_DISTRICT}_October_2025_planning_v2.csv`,
      phase: "planning",
      status: "committed",
      service_month: DEMO_SERVICE_MONTH,
      committed_at: "2025-10-08T09:15:00Z",
      school_groups: ["Lowndes High School · Self Contained"],
    });
  }

  const authorizations: DemoAuthorization[] = [valdostaAuth(valdostaReleased)];
  if (hasLowndes) authorizations.push(lowndesAuth());

  const rosters: Record<string, DemoRosterStudent[]> = {
    "demo-auth-valdosta": VALDOSTA_ROSTER,
    "demo-auth-lowndes": LOWNDES_ROSTER,
  };

  const pipeline: DemoPipelineRow[] = [
    {
      schoolName: "Valdosta High School",
      groupName: "Self Contained",
      status: valdostaReleased ? "roster_submitted" : "pending_authorization",
      studentCount: VALDOSTA_ROSTER.length,
      authNumber: valdostaReleased ? "87654321" : null,
      instructorName: "Madison Hewett",
    },
    {
      schoolName: "Lowndes High School",
      groupName: "Self Contained",
      status: hasLowndes ? "pending_authorization" : "awaiting_spreadsheet",
      studentCount: hasLowndes ? LOWNDES_ROSTER.length : 0,
      authNumber: null,
      instructorName: "Madison Hewett",
    },
    {
      schoolName: "Berrien County High School",
      groupName: "Weekly",
      status: "awaiting_spreadsheet",
      studentCount: 0,
      authNumber: null,
      instructorName: "Madison Hewett",
    },
  ];

  const sessions: DemoSession[] =
    valdostaReleased && s >= 4
      ? [
          {
            id: "demo-session-1",
            session_date: "2025-10-15",
            school_name: "Valdosta High School",
            auth_number: "87654321",
            status: "scheduled",
            has_signed_roster: false,
            has_car: false,
          },
          {
            id: "demo-session-2",
            session_date: "2025-10-22",
            school_name: "Valdosta High School",
            auth_number: "87654321",
            status: "scheduled",
            has_signed_roster: false,
            has_car: false,
          },
        ]
      : [];

  const notifications: DemoNotification[] = [];
  if (s >= 2) {
    notifications.push({
      id: "demo-notify-1",
      title: "Pre-ETS authorization requests submitted",
      body: hasLowndes
        ? "Authorization requests submitted for Valdosta High School · Self Contained and Lowndes High School · Self Contained (District 9, October 2025)."
        : "Authorization requests submitted for Valdosta High School · Self Contained (District 9, October 2025).",
      created_at: "2025-10-03T14:23:00Z",
    });
  }
  if (hasLowndes && s >= 5) {
    notifications.push({
      id: "demo-notify-2",
      title: "Pre-ETS authorization requests submitted",
      body: "Authorization requests submitted for Lowndes High School · Self Contained (District 9, October 2025). Valdosta was not duplicated.",
      created_at: "2025-10-08T09:16:00Z",
    });
  }
  if (valdostaReleased && s >= 3) {
    notifications.push({
      id: "demo-notify-3",
      title: "Pre-ETS roster released",
      body: "Valdosta High School · Self Contained is released to Madison Hewett and Ashley Kelley (auth 87654321).",
      created_at: "2025-10-04T11:00:00Z",
    });
  }

  const fieldBlocked = s < 4 || !valdostaReleased;

  return {
    step: s,
    worksheetImports,
    authorizations,
    rosters,
    pipeline,
    sessions,
    notifications,
    fieldBlocked,
    fieldMessage: fieldBlocked
      ? "Training step: TS/TI cannot access Valdosta until Accounts enters the GVRA authorization number (complete Step 3)."
      : hasLowndes
        ? "Valdosta is released below. Lowndes stays hidden until Accounts finalizes it (Step 5 scenario — still pending in mock data)."
        : "Valdosta roster is released — schedule sessions and print sign-in sheets below.",
  };
}
