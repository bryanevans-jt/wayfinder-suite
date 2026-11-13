/** Client-safe feedback types and validation for Wayfinder Pro team feedback. */

export const FEEDBACK_TYPES = ["problem", "feature"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

export const FEEDBACK_STATUSES = [
  "new",
  "under_review",
  "approved",
  "on_hold",
  "ignored",
  "fixed",
] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_TYPE_LABELS: Record<FeedbackType, string> = {
  problem: "Report a problem",
  feature: "Request or suggest a feature",
};

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  new: "New",
  under_review: "Under review",
  approved: "Approved",
  on_hold: "On hold",
  ignored: "Ignored",
  fixed: "Fixed",
};

export const FEEDBACK_TITLE_MAX = 120;
export const FEEDBACK_DESCRIPTION_MAX = 8000;

export type FeedbackSubmitInput = {
  type?: string | null;
  title?: string | null;
  description?: string | null;
  pageUrl?: string | null;
  userAgent?: string | null;
  appVersion?: string | null;
  attachmentPath?: string | null;
};

export type FeedbackSubmitParsed = {
  type: FeedbackType;
  title: string;
  description: string;
  pageUrl: string | null;
  userAgent: string | null;
  appVersion: string | null;
  attachmentPath: string | null;
};

export function isFeedbackType(value: string | null | undefined): value is FeedbackType {
  return (FEEDBACK_TYPES as readonly string[]).includes(String(value ?? ""));
}

export function isFeedbackStatus(value: string | null | undefined): value is FeedbackStatus {
  return (FEEDBACK_STATUSES as readonly string[]).includes(String(value ?? ""));
}

export function parseFeedbackSubmitInput(
  input: FeedbackSubmitInput
): { ok: true; value: FeedbackSubmitParsed } | { ok: false; error: string } {
  const typeRaw = String(input.type ?? "").trim();
  if (!isFeedbackType(typeRaw)) {
    return { ok: false, error: "Please choose whether this is a problem or a feature request." };
  }

  const title = String(input.title ?? "").trim();
  if (!title) {
    return { ok: false, error: "Please add a short title." };
  }
  if (title.length > FEEDBACK_TITLE_MAX) {
    return { ok: false, error: `Keep the title under ${FEEDBACK_TITLE_MAX} characters.` };
  }

  const description = String(input.description ?? "").trim();
  if (!description) {
    return { ok: false, error: "Please describe what happened or what you would like." };
  }
  if (description.length > FEEDBACK_DESCRIPTION_MAX) {
    return {
      ok: false,
      error: `Keep the description under ${FEEDBACK_DESCRIPTION_MAX} characters.`,
    };
  }

  const pageUrl = String(input.pageUrl ?? "").trim() || null;
  const userAgent = String(input.userAgent ?? "").trim() || null;
  const appVersion = String(input.appVersion ?? "").trim() || null;
  const attachmentPath = String(input.attachmentPath ?? "").trim() || null;

  if (attachmentPath && !isSafeFeedbackAttachmentPath(attachmentPath)) {
    return { ok: false, error: "That attachment path is not valid." };
  }

  return {
    ok: true,
    value: {
      type: typeRaw,
      title,
      description,
      pageUrl,
      userAgent,
      appVersion,
      attachmentPath,
    },
  };
}

/** Attachment paths must stay under the submitter's own storage prefix. */
export function isSafeFeedbackAttachmentPath(
  path: string,
  submitterUserId?: string
): boolean {
  const cleaned = path.trim();
  if (!cleaned || cleaned.includes("..") || cleaned.startsWith("/")) return false;
  if (!/^[a-zA-Z0-9/_\-.]+$/.test(cleaned)) return false;
  if (submitterUserId && !cleaned.startsWith(`${submitterUserId}/`)) return false;
  return true;
}

export function feedbackTypeLabel(type: FeedbackType): string {
  return FEEDBACK_TYPE_LABELS[type];
}

export function feedbackStatusLabel(status: FeedbackStatus): string {
  return FEEDBACK_STATUS_LABELS[status];
}
