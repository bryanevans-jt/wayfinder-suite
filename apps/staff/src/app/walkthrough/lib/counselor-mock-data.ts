import type { ClientActivityFeedItem } from "@wayfinder/branding";

export const DEMO_COUNSELOR = {
  full_name: "Pat Morgan",
  agency: "Georgia Vocational Rehabilitation Agency",
};

export type DemoCounselorClient = {
  linkId: string;
  displayName: string;
  stage: string;
  applications: number;
  lastActivity: string;
  latestAppStatus: string | null;
  archived: boolean;
};

export const DEMO_COUNSELOR_CLIENTS: DemoCounselorClient[] = [
  {
    linkId: "sample-alex",
    displayName: "Alex R.",
    stage: "Job development",
    applications: 4,
    lastActivity: "2026-06-28T15:20:00.000Z",
    latestAppStatus: "Interview scheduled",
    archived: false,
  },
  {
    linkId: "sample-jordan",
    displayName: "Jordan T.",
    stage: "Job placement",
    applications: 6,
    lastActivity: "2026-07-01T11:00:00.000Z",
    latestAppStatus: "Hired",
    archived: false,
  },
  {
    linkId: "sample-sam",
    displayName: "Sam K.",
    stage: "Closed",
    applications: 2,
    lastActivity: "2026-03-12T09:30:00.000Z",
    latestAppStatus: null,
    archived: true,
  },
];

export const DEMO_COUNSELOR_FEEDS: Record<string, ClientActivityFeedItem[]> = {
  "sample-alex": [
    {
      kind: "milestone",
      id: "m1",
      at: "2026-05-01T10:00:00.000Z",
      title: "Assessment complete",
    },
    {
      kind: "contact",
      id: "c1",
      at: "2026-05-15T14:00:00.000Z",
      public_outcome: "Met in person at office",
      notes: "Reviewed job interests and transportation plan.",
    },
    {
      kind: "application",
      id: "a1",
      at: "2026-06-02T16:30:00.000Z",
      status: "Applied",
      company_name: "Coastal Retail Group",
      notes: "Submitted online application with resume.",
    },
    {
      kind: "application",
      id: "a2",
      at: "2026-06-28T15:20:00.000Z",
      status: "Interview scheduled",
      company_name: "Harbor Foods",
      notes: "Phone screen set for next Tuesday at 2:00 PM.",
    },
    {
      kind: "meeting",
      id: "mtg1",
      at: "2026-06-20T09:00:00.000Z",
      status: "accepted",
      starts_at: "2026-07-08T18:00:00.000Z",
      location: "Savannah office · Room B",
      timezone: "America/New_York",
      service_name: "Supported employment",
      es_name: "Taylor Brooks",
    },
  ],
  "sample-jordan": [
    {
      kind: "milestone",
      id: "m2",
      at: "2026-04-10T10:00:00.000Z",
      title: "Job placement",
    },
    {
      kind: "contact",
      id: "c2",
      at: "2026-06-18T13:00:00.000Z",
      public_outcome: "Phone call",
      notes: "Employer confirmed start date and uniform requirements.",
    },
    {
      kind: "application",
      id: "a3",
      at: "2026-07-01T11:00:00.000Z",
      status: "Hired",
      company_name: "Lowcountry Logistics",
      notes: "Warehouse associate — 32 hrs/week.",
    },
  ],
  "sample-sam": [
    {
      kind: "milestone",
      id: "m3",
      at: "2026-01-08T10:00:00.000Z",
      title: "Assessment complete",
    },
    {
      kind: "contact",
      id: "c3",
      at: "2026-03-12T09:30:00.000Z",
      public_outcome: "Case closed — moved out of area",
      notes: "Participant relocated; file closed per agency guidance.",
    },
  ],
};

export function getDemoClient(linkId: string) {
  return DEMO_COUNSELOR_CLIENTS.find((c) => c.linkId === linkId) ?? null;
}
