/** Shared Generate Month / cron batching knobs (no heavy imports). */

export const IJP_BILLING_MONTH_ROW_BATCH = 25;
export const IJP_BILLING_MONTH_COMPILE_BATCH = 8;
/** Vercel Pro-friendly ceiling for generate-month + cron. */
export const IJP_BILLING_MONTH_MAX_DURATION_SEC = 300;
