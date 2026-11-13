/** Feedback attachment uploads go to Supabase Storage via signed URLs. */
export const FEEDBACK_ATTACHMENT_BUCKET = "feedback-attachments";
export const FEEDBACK_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

export function resolveFeedbackAttachmentMime(file: {
  type: string;
  name: string;
}): string | null {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  const lower = file.name.toLowerCase();
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.webp$/.test(lower)) return "image/webp";
  if (/\.heic$/.test(lower)) return "image/heic";
  if (/\.heif$/.test(lower)) return "image/heif";
  if (/\.pdf$/.test(lower)) return "application/pdf";
  return null;
}

export function feedbackAttachmentExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  if (mime === "application/pdf") return "pdf";
  return "jpg";
}

export function isFeedbackAttachmentFile(file: File): boolean {
  return resolveFeedbackAttachmentMime(file) != null && file.size > 0;
}
