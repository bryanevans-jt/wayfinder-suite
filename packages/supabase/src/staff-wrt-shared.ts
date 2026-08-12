import { isAdminTierRole, isWrtAdminRole } from "./roles";

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

/** Admin tier + WRT Admin curriculum / facilitation access. */
export function isWrtCurriculumPreviewUnlocked(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isWrtAdminRole(role);
}

export function canManageWrtCurriculum(role: string | null | undefined): boolean {
  return isWrtCurriculumPreviewUnlocked(role);
}

/** ES/TS facilitation UI is built; access is admin tier + WRT Admin. */
export function canUseWrtFacilitationPreview(role: string | null | undefined): boolean {
  return isWrtCurriculumPreviewUnlocked(role);
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
