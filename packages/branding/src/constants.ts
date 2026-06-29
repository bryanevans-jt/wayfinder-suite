/** Formal reporting product name (reports app / PWA). */
export const REPORTS_APP_PRODUCT_NAME = "Joshua Tree Reports";

/** Client-facing product name (App Store / client app). */
export const CLIENT_APP_PRODUCT_NAME = "Wayfinder";

/** Team-member-facing product name (App Store / Wayfinder Pro app). */
export const STAFF_APP_PRODUCT_NAME = "Wayfinder Pro";

/** Logo alt text in the shared header (logo is the visible brand mark). */
export const WAYFINDER_LOGO_ALT = "Wayfinder";

/** Suggested production URL slug for the client app (e.g. wayfinder.thejoshuatree.org). */
export const CLIENT_APP_URL_SLUG = "wayfinder";

/** Suggested production URL slug for the staff app (e.g. wayfinder-pro.thejoshuatree.org). */
export const STAFF_APP_URL_SLUG = "wayfinder-pro";

/** Legacy Firebase / vocationalreports entry (retired after Wayfinder integrated reports). */
export const JT_VOCATIONAL_REPORTS_URL = "https://www.thejoshuatree.org/vocationalreports";

/** Production URL for integrated formal reporting (`apps/reports`). */
export const WAYFINDER_REPORTS_URL = "https://wayfinder-reports.thejoshuatree.org";

/** Primary product mark (add `wayfinder-logo.png` to each app's `public/` folder). */
export const WAYFINDER_LOGO_PATH = "/wayfinder-logo.png";

/** Browser tab / PWA favicon — RGBA PNG with transparent background (`public/favicon.png`). */
export const WAYFINDER_FAVICON_PATH = "/favicon.png";

/** Home screen / PWA install icon (`public/icon-512.png`). */
export const WAYFINDER_PWA_ICON_PATH = "/icon-512.png";

/** Joshua Tree mark — developer badge only (typically existing `logo.png`). */
export const DEVELOPER_BADGE_LOGO_PATH = "/logo.png";

/**
 * Supabase auth email templates use `{{ .SiteURL }}` + this path for the header logo.
 * Site URL must be a public HTTPS origin that serves `public/wayfinder-logo.png`
 * (typically your deployed staff app). localhost will not work in real inboxes.
 */
export const EMAIL_LOGO_PATH = WAYFINDER_LOGO_PATH;

export const APP_VERSION = "0.11.0";

/** Primary technical contact while Wayfinder is in rollout. */
export const SUPPORT_CONTACT_NAME = "Bryan Evans";
export const SUPPORT_CONTACT_EMAIL = "bryan.evans@thejoshuatree.org";
export const SUPPORT_CONTACT_MAILTO = `mailto:${SUPPORT_CONTACT_EMAIL}`;

export const LEGAL_ENTITY = "Joshua Tree Service Group";

export const CONFIDENTIALITY_NOTICE =
  "The information in this application is confidential and may not be shared, copied, or disclosed without the prior written express consent of Joshua Tree Service Group.";

/** Counselor-visible contact log field (stored in `contact_logs.public_outcome`). */
export const CONTACT_LOG_NOTES_LABEL = "Notes";

/** ES-only contact log field (stored in `contact_logs.notes`). */
export const CONTACT_LOG_INTERNAL_NOTES_LABEL = "Internal Notes (Optional)";
