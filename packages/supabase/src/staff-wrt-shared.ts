import { isAdminTierRole, isFieldSpecialistRole, isSupervisorRole } from "./roles";

export const WRT_BLOCK_TYPES = [
  "rich_text",
  "youtube",
  "pdf_link",
  "quiz",
  "activity",
  "external_link",
] as const;

export type WrtBlockType = (typeof WRT_BLOCK_TYPES)[number];

export type WrtModuleRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  citations: string | null;
  sort_order: number;
  is_optional: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type WrtLessonRow = {
  id: string;
  module_id: string;
  slug: string;
  title: string;
  objectives: string | null;
  desired_outcomes: string | null;
  facilitator_notes: string | null;
  citations: string | null;
  default_duration_minutes: number;
  sort_order: number;
  is_optional: boolean;
  published: boolean;
  created_at: string;
  updated_at: string;
};

export type WrtLessonBlockRow = {
  id: string;
  lesson_id: string;
  block_type: WrtBlockType;
  title: string | null;
  body: string | null;
  url: string | null;
  meta: Record<string, unknown>;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WrtLessonWithBlocks = WrtLessonRow & { blocks: WrtLessonBlockRow[] };

export type WrtModuleWithLessons = WrtModuleRow & { lessons: WrtLessonWithBlocks[] };

/** Curriculum editor entry in nav — admin tier only (facilitation is wider; see canUseWrtFacilitation). */
export function isWrtCurriculumPreviewUnlocked(role: string | null | undefined): boolean {
  return isAdminTierRole(role);
}

/** Editing modules, lessons, and blocks — Super Admin and Admin only. */
export function canManageWrtCurriculum(role: string | null | undefined): boolean {
  return isAdminTierRole(role);
}

/** Curriculum editing — Admin / Super Admin only. */
export function canUseWrtFacilitationPreview(role: string | null | undefined): boolean {
  return canUseWrtFacilitation(role);
}

/** Facilitation workspace (log sessions, presentation, print kit) — ES/TS, supervisors, and admin tier. */
export function canUseWrtFacilitation(role: string | null | undefined): boolean {
  const r = (role ?? "").trim().toLowerCase();
  return isAdminTierRole(r) || isFieldSpecialistRole(r) || isSupervisorRole(r);
}

export const WRT_DELIVERY_MODES = ["in_person", "virtual"] as const;
export type WrtDeliveryMode = (typeof WRT_DELIVERY_MODES)[number];

export const WRT_ENROLLMENT_STATUSES = ["active", "ended"] as const;
export type WrtEnrollmentStatus = (typeof WRT_ENROLLMENT_STATUSES)[number];

export type WrtEnrollmentRow = {
  id: string;
  client_id: string;
  delivery_mode: WrtDeliveryMode;
  requested_hours: number;
  status: WrtEnrollmentStatus;
  enrolled_by: string | null;
  created_at: string;
  updated_at: string;
  ended_at: string | null;
};

export type WrtSessionRow = {
  id: string;
  lesson_id: string | null;
  /** Optional multi-segment list (session block); when set, takes precedence over lesson_id for logging. */
  lesson_ids?: string[] | null;
  /** Single duration for the whole block (minutes). Billable minutes per present client = block × present count. */
  session_block_minutes?: number | null;
  scheduled_start: string;
  scheduled_end: string | null;
  delivery_mode: WrtDeliveryMode;
  zoom_url: string | null;
  status: "scheduled" | "completed" | "cancelled";
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export const WRT_ACTIVITY_CODE = "JT-ACT-070";

/** Observational Workplace Readiness Rubric — staff-only; levels 1–3. */
export const WRT_RUBRIC_DOMAIN_KEYS = [
  "punctuality_attendance",
  "hygiene_presentation",
  "social_communication",
  "task_engagement",
  "receptivity_supervision",
] as const;

export type WrtRubricDomainKey = (typeof WRT_RUBRIC_DOMAIN_KEYS)[number];

export const WRT_RUBRIC_DOMAIN_LABELS: Record<WrtRubricDomainKey, string> = {
  punctuality_attendance: "Punctuality & Attendance",
  hygiene_presentation: "Hygiene & Presentation",
  social_communication: "Social Communication",
  task_engagement: "Task Engagement & Focus",
  receptivity_supervision: "Receptivity to Supervision",
};

export function isValidWrtBlockType(value: string): value is WrtBlockType {
  return (WRT_BLOCK_TYPES as readonly string[]).includes(value);
}

/** Extract YouTube video id from watch / youtu.be / embed URLs. */
export function parseYoutubeVideoId(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id && /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v && /^[\w-]{11}$/.test(v)) return v;
      const embed = url.pathname.match(/\/embed\/([\w-]{11})/);
      if (embed?.[1]) return embed[1];
    }
  } catch {
    return null;
  }
  return null;
}

export function youtubeEmbedUrl(videoIdOrUrl: string): string | null {
  const id = parseYoutubeVideoId(videoIdOrUrl);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}
