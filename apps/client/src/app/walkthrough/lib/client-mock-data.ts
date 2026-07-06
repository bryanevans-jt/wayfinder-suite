import type { TrailMilestone } from "@/app/dashboard/desert-trail";

export const DEMO_CLIENT_EMAIL = "participant@example.com";

export const DEMO_SERVICE = {
  name: "Supported employment",
  currentStageTitle: "Job development",
  currentStageId: "stage-dev",
};

export const DEMO_MILESTONES: TrailMilestone[] = [
  {
    id: "stage-assess",
    order_index: 1,
    title: "Assessment",
    description: "Goals, skills, and support needs documented with your ES.",
  },
  {
    id: "stage-dev",
    order_index: 2,
    title: "Job development",
    description: "Exploring employers and preparing applications together.",
  },
  {
    id: "stage-place",
    order_index: 3,
    title: "Job placement",
    description: "Interviewing and starting work with on-the-job support.",
  },
  {
    id: "stage-retain",
    order_index: 4,
    title: "Job retention",
    description: "Ongoing coaching to help you succeed in your role.",
  },
];

export const DEMO_APPLICATIONS = [
  {
    id: "app1",
    company_name: "Harbor Foods",
    status: "Interview scheduled",
    updated_at: "2026-06-28T15:20:00.000Z",
  },
  {
    id: "app2",
    company_name: "Coastal Retail Group",
    status: "Applied",
    updated_at: "2026-06-02T16:30:00.000Z",
  },
];

export const DEMO_MEETING = {
  id: "demo-meeting",
  status: "pending" as const,
  starts_at: "2026-07-10T18:00:00.000Z",
  timezone: "America/New_York",
  location: "Savannah office · Room B",
  service_name: "Supported employment",
  es_name: "Taylor Brooks",
};

export const DEMO_MESSAGES = [
  {
    id: "msg1",
    body: "Hi Alex! I scheduled a practice interview for Thursday. Let me know if that time still works.",
    sender_role: "es",
    sender_name: "Taylor Brooks",
    created_at: "2026-06-27T14:10:00.000Z",
  },
  {
    id: "msg2",
    body: "Thursday works great. I'll review the employer info you sent.",
    sender_role: "client",
    sender_name: null,
    created_at: "2026-06-27T16:45:00.000Z",
  },
];

export const DEMO_ACTIVITY_FEED = [
  {
    kind: "contact" as const,
    id: "log1",
    at: "2026-06-18T13:00:00.000Z",
    public_outcome: "Phone call",
    notes: "Reviewed interview questions and transportation for Harbor Foods.",
  },
  {
    kind: "application" as const,
    id: "app1",
    at: "2026-06-28T15:20:00.000Z",
    status: "Interview scheduled",
    company_name: "Harbor Foods",
    notes: "Phone screen confirmed for next week.",
  },
];
