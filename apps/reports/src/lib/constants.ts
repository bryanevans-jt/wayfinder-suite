// Supported Employment stages - trigger Missing/Overdue Reports check
export const SUPPORTED_EMPLOYMENT_STAGES = [
  'Job Development',
  'Training / OS 1',
  'Training / OS 2',
  'Stabilization / ES',
] as const;

export type SupportedEmploymentStage = (typeof SUPPORTED_EMPLOYMENT_STAGES)[number];

export const ALL_VPR_SERVICE_STAGES = [
  'Job Development',
  'Training / OS 1',
  'Training / OS 2',
  'Stabilization / ES',
  'Work Readiness Training',
  'IJP',
  'CWAT',
  'Job Coaching',
  'Work Evaluation',
] as const;

export const SUPERADMIN_EMAIL = 'bryan.evans@thejoshuatree.org';
export const ORG_DOMAIN = 'thejoshuatree.org';
export const FROM_EMAIL = 'noreply@thejoshuatree.org';

// GVRA funder deadline: 5:01pm ET on the 10th = late for compliance status
export const GVRA_DEADLINE_HOUR = 17;
export const GVRA_DEADLINE_MINUTE = 1;
export const GVRA_DEADLINE_DAY = 10;

/** Internal overdue alert email/notification (vercel cron: 6th at 19:00 UTC ≈ 3:00 PM EDT). */
export const OVERDUE_ALERT_DAY = 6;
export const OVERDUE_ALERT_HOUR = 15;
export const OVERDUE_ALERT_MINUTE = 0;
