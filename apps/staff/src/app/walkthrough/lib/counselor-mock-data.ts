import type { ClientActivityFeedItem } from "@wayfinder/branding";

export const DEMO_COUNSELOR = {
  full_name: "Pat Morgan",
  agency: "Georgia Vocational Rehabilitation Agency",
  emailHint: "official GVRA email",
};

export type DemoCounselorClient = {
  linkId: string;
  displayName: string;
  serviceName: string;
  stage: string;
  applications: number;
  lastActivity: string;
  latestAppStatus: string | null;
  archived: boolean;
  esName: string;
};

export const DEMO_COUNSELOR_CLIENTS: DemoCounselorClient[] = [
  {
    linkId: "sample-morgan-ellis",
    displayName: "Morgan Ellis",
    serviceName: "Traditional Supported Employment",
    stage: "Job Development",
    applications: 4,
    lastActivity: "2026-08-20T15:20:00.000Z",
    latestAppStatus: "Interview scheduled",
    archived: false,
    esName: "Avery Quinn",
  },
  {
    linkId: "sample-casey-nguyen",
    displayName: "Casey Nguyen",
    serviceName: "Individual Job Placement (IJP)",
    stage: "Working",
    applications: 6,
    lastActivity: "2026-08-18T11:00:00.000Z",
    latestAppStatus: "Hired",
    archived: false,
    esName: "Jordan Blake",
  },
  {
    linkId: "sample-riley-brooks",
    displayName: "Riley Brooks",
    serviceName: "Workplace Readiness Training",
    stage: "Open",
    applications: 0,
    lastActivity: "2026-08-22T14:30:00.000Z",
    latestAppStatus: null,
    archived: false,
    esName: "Sam Rivera",
  },
  {
    linkId: "sample-jamie-ortiz",
    displayName: "Jamie Ortiz",
    serviceName: "Job Coaching",
    stage: "Open",
    applications: 1,
    lastActivity: "2026-08-19T16:45:00.000Z",
    latestAppStatus: null,
    archived: false,
    esName: "Taylor Brooks",
  },
  {
    linkId: "sample-alex-reed",
    displayName: "Alex Reed",
    serviceName: "Traditional Supported Employment",
    stage: "Closed",
    applications: 2,
    lastActivity: "2026-03-12T09:30:00.000Z",
    latestAppStatus: null,
    archived: true,
    esName: "Avery Quinn",
  },
];

export const DEMO_COUNSELOR_FEEDS: Record<string, ClientActivityFeedItem[]> = {
  "sample-morgan-ellis": [
    {
      kind: "milestone",
      id: "m-me-1",
      at: "2026-05-01T10:00:00.000Z",
      title: "Phase 1 Intake complete",
    },
    {
      kind: "contact",
      id: "c-me-1",
      at: "2026-05-15T14:00:00.000Z",
      public_outcome: "Met in person at office",
      notes: "Reviewed job interests, transportation, and preferred work schedule.",
    },
    {
      kind: "application",
      id: "a-me-1",
      at: "2026-06-02T16:30:00.000Z",
      status: "Applied",
      company_name: "Coastal Retail Group",
      notes: "Submitted online application with resume.",
    },
    {
      kind: "application",
      id: "a-me-2",
      at: "2026-08-20T15:20:00.000Z",
      status: "Interview scheduled",
      company_name: "Harbor Foods",
      notes: "Phone screen set for next Tuesday at 2:00 PM.",
    },
    {
      kind: "meeting",
      id: "mtg-me-1",
      at: "2026-08-12T09:00:00.000Z",
      status: "accepted",
      starts_at: "2026-08-28T18:00:00.000Z",
      location: "Savannah office · Room B",
      timezone: "America/New_York",
      service_name: "Traditional Supported Employment",
      es_name: "Avery Quinn",
    },
  ],
  "sample-casey-nguyen": [
    {
      kind: "milestone",
      id: "m-cn-1",
      at: "2026-04-10T10:00:00.000Z",
      title: "Hired",
    },
    {
      kind: "contact",
      id: "c-cn-1",
      at: "2026-06-18T13:00:00.000Z",
      public_outcome: "Phone call",
      notes: "Employer confirmed start date and uniform requirements.",
    },
    {
      kind: "application",
      id: "a-cn-1",
      at: "2026-07-01T11:00:00.000Z",
      status: "Hired",
      company_name: "Lowcountry Logistics",
      notes: "Warehouse associate — 32 hrs/week.",
    },
    {
      kind: "milestone",
      id: "m-cn-2",
      at: "2026-08-18T11:00:00.000Z",
      title: "Working",
    },
    {
      kind: "contact",
      id: "c-cn-2",
      at: "2026-08-18T11:00:00.000Z",
      public_outcome: "Worksites visit",
      notes: "Check-in with supervisor; hours and duties going well.",
    },
  ],
  "sample-riley-brooks": [
    {
      kind: "milestone",
      id: "m-rb-1",
      at: "2026-08-01T10:00:00.000Z",
      title: "Open",
    },
    {
      kind: "contact",
      id: "c-rb-1",
      at: "2026-08-08T15:00:00.000Z",
      public_outcome: "Met in person at school",
      notes: "Orientation to Workplace Readiness Training modules and attendance expectations.",
    },
    {
      kind: "contact",
      id: "c-rb-2",
      at: "2026-08-22T14:30:00.000Z",
      public_outcome: "Group session",
      notes: "Completed soft-skills module on workplace communication.",
    },
    {
      kind: "meeting",
      id: "mtg-rb-1",
      at: "2026-08-20T09:00:00.000Z",
      status: "accepted",
      starts_at: "2026-08-29T15:00:00.000Z",
      location: "Career center · Training room 2",
      timezone: "America/New_York",
      service_name: "Workplace Readiness Training",
      es_name: "Sam Rivera",
    },
  ],
  "sample-jamie-ortiz": [
    {
      kind: "milestone",
      id: "m-jo-1",
      at: "2026-07-15T10:00:00.000Z",
      title: "Open",
    },
    {
      kind: "contact",
      id: "c-jo-1",
      at: "2026-07-22T11:30:00.000Z",
      public_outcome: "Phone call",
      notes: "Discussed coaching schedule around current job hours.",
    },
    {
      kind: "application",
      id: "a-jo-1",
      at: "2026-07-10T09:00:00.000Z",
      status: "Working",
      company_name: "Pinecrest Hospitality",
      notes: "Front-desk associate — coaching focused on task pacing.",
    },
    {
      kind: "contact",
      id: "c-jo-2",
      at: "2026-08-19T16:45:00.000Z",
      public_outcome: "On-site coaching",
      notes: "Practiced customer greeting script; employer feedback positive.",
    },
  ],
  "sample-alex-reed": [
    {
      kind: "milestone",
      id: "m-ar-1",
      at: "2026-01-08T10:00:00.000Z",
      title: "Assessment complete",
    },
    {
      kind: "contact",
      id: "c-ar-1",
      at: "2026-02-20T14:00:00.000Z",
      public_outcome: "Phone call",
      notes: "Case closing discussion; services completed.",
    },
    {
      kind: "milestone",
      id: "m-ar-2",
      at: "2026-03-12T09:30:00.000Z",
      title: "Closed",
    },
  ],
};

export function getDemoClient(linkId: string) {
  return DEMO_COUNSELOR_CLIENTS.find((c) => c.linkId === linkId) ?? null;
}
