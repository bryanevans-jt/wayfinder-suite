/** Client-facing product name (App Store / client app). */
export const CLIENT_APP_PRODUCT_NAME = "Wayfinder";

/** Staff-facing product name (App Store / staff app). */
export const STAFF_APP_PRODUCT_NAME = "Wayfinder Pro";

/** Suggested production URL slug for the client app (e.g. wayfinder.thejoshuatree.org). */
export const CLIENT_APP_URL_SLUG = "wayfinder";

/** Suggested production URL slug for the staff app (e.g. wayfinder-pro.thejoshuatree.org). */
export const STAFF_APP_URL_SLUG = "wayfinder-pro";

/** Primary product mark (add `wayfinder-logo.png` to each app's `public/` folder). */
export const WAYFINDER_LOGO_PATH = "/wayfinder-logo.png";

/** Joshua Tree mark — developer badge only (typically existing `logo.png`). */
export const DEVELOPER_BADGE_LOGO_PATH = "/logo.png";

/**
 * Supabase auth email templates use `{{ .SiteURL }}` + this path for the header logo.
 * Site URL must be a public HTTPS origin that serves `public/wayfinder-logo.png`
 * (typically your deployed staff app). localhost will not work in real inboxes.
 */
export const EMAIL_LOGO_PATH = WAYFINDER_LOGO_PATH;

export const APP_VERSION = "0.1.0";

export const LEGAL_ENTITY = "Joshua Tree Service Group";

export const CONFIDENTIALITY_NOTICE =
  "The information in this application is confidential and may not be shared, copied, or disclosed without the prior written express consent of Joshua Tree Service Group.";
