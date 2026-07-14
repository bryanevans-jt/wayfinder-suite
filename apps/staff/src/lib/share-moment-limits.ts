/** Share a Moment uploads go to Supabase Storage (not through the Vercel request body). */
export const SHARE_MOMENT_BUCKET = "team-moments";
export const SHARE_MOMENT_MAX_PHOTOS = 5;
/** Per-photo cap for full-quality phone originals. */
export const SHARE_MOMENT_MAX_PHOTO_BYTES = 25 * 1024 * 1024;
/** Combined originals staged for one submission. */
export const SHARE_MOMENT_MAX_TOTAL_BYTES = 80 * 1024 * 1024;
/**
 * Gmail's message size limit is ~25MB after encoding. Keep attachments under this
 * binary total; larger submissions email signed download links instead.
 */
export const SHARE_MOMENT_MAX_ATTACHMENT_BYTES = 18 * 1024 * 1024;
export const SHARE_MOMENT_LINK_TTL_SECONDS = 60 * 60 * 24;
/** Orphaned / link-backed uploads older than this are removed by cron. */
export const SHARE_MOMENT_RETENTION_MS = 60 * 60 * 24 * 1000;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);

export function resolveShareMomentMime(file: { type: string; name: string }): string | null {
  if (ALLOWED_MIME.has(file.type)) return file.type;
  const lower = file.name.toLowerCase();
  if (/\.jpe?g$/.test(lower)) return "image/jpeg";
  if (/\.png$/.test(lower)) return "image/png";
  if (/\.webp$/.test(lower)) return "image/webp";
  if (/\.heic$/.test(lower)) return "image/heic";
  if (/\.heif$/.test(lower)) return "image/heif";
  return null;
}

export function shareMomentExtension(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/heic" || mime === "image/heif") return "heic";
  return "jpg";
}

export function isShareMomentImage(file: File): boolean {
  return resolveShareMomentMime(file) != null && file.size > 0;
}
