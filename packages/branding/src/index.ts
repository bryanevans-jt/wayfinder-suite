export {
  APP_VERSION,
  CLIENT_APP_PRODUCT_NAME,
  CLIENT_APP_URL_SLUG,
  CONFIDENTIALITY_NOTICE,
  DEVELOPER_BADGE_LOGO_PATH,
  LEGAL_ENTITY,
  STAFF_APP_PRODUCT_NAME,
  JT_VOCATIONAL_REPORTS_URL,
  WAYFINDER_LOGO_ALT,
  STAFF_APP_URL_SLUG,
  SUPPORT_CONTACT_EMAIL,
  SUPPORT_CONTACT_MAILTO,
  SUPPORT_CONTACT_NAME,
  WAYFINDER_FAVICON_PATH,
  WAYFINDER_LOGO_PATH,
  CONTACT_LOG_INTERNAL_NOTES_LABEL,
  CONTACT_LOG_NOTES_LABEL,
} from "./constants";
export { buildJtReportsPrefillUrl, buildReportsAppUrl, reportsAppBaseUrl, type JtReportPrefillType } from "./jt-reports-prefill";
export { ClientActivityTimeline, type ClientActivityFeedItem } from "./client-activity-timeline";
export {
  buildClientActivityFeed,
  milestoneTitleFromEmbed,
} from "./client-activity-feed";
export {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  isApplicationStatus,
  isGoldApplicationStatus,
  type ApplicationStatus,
} from "./application-status";
export {
  EMPLOYMENT_CATEGORIES,
  EMPLOYMENT_CATEGORY_LABELS,
  employmentCategoryLabel,
  employmentGoalsMatch,
  isEmploymentCategory,
  normalizeEmploymentGoal,
  validateEmploymentCategoryFields,
  type EmploymentCategory,
  type EmploymentGoalInput,
} from "./employment-categories";
export { formatPortalDateTime } from "./portal-datetime";
export {
  dedupeServicesForSelect,
  formatServiceLabel,
  parseServiceParts,
  serviceDisplayName,
  servicesForClientEdit,
  type ServiceRowInput,
  type ServiceSelectOption,
} from "./service-display";
export {
  clientDisplayName,
  personDisplayName,
  resolveStaffDisplayName,
  staffDisplayName,
  type PersonLabelInput,
} from "./person-display-name";
export { MEETING_TIMEZONES } from "./meeting-timezones";
export { WayfinderFooter } from "./wayfinder-footer";
export { WayfinderTopNav, type WayfinderNavBadge } from "./wayfinder-top-nav";
export { wayfinderSecurityHeaders } from "./security-headers";
export {
  TERMS_OF_USE_LAST_UPDATED,
  TermsOfUseContent,
} from "./legal/terms-of-use-content";
