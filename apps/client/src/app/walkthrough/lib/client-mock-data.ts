import type { TrailMilestone } from "@/app/dashboard/desert-trail";

export const DEMO_CLIENT_EMAIL = "participant@example.com";

export const DEMO_SERVICE = {
  name: "Traditional Supported Employment (GA)",
  currentStageTitle: "Phase 2: Job Development",
  currentStageId: "stage-dev",
};

export const DEMO_MILESTONES: TrailMilestone[] = [
  {
    id: "stage-intake",
    order_index: 1,
    title: "Phase 1: Intake",
    description: "Goals, skills, and support needs documented with your Employment Specialist.",
  },
  {
    id: "stage-dev",
    order_index: 2,
    title: "Phase 2: Job Development",
    description: "Exploring employers and preparing applications together.",
  },
  {
    id: "stage-os1",
    order_index: 3,
    title: "Phase 3: Training & OS 1",
    description: "On-the-job training and early supports as you start work.",
  },
  {
    id: "stage-os2",
    order_index: 4,
    title: "Phase 4: Training & OS 2",
    description: "Continued coaching and skill building in your role.",
  },
  {
    id: "stage-stabilize",
    order_index: 5,
    title: "Stabilization / Extended Support",
    description: "Ongoing coaching to help you succeed and maintain employment.",
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
  service_name: "Traditional Supported Employment (GA)",
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
