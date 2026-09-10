/** Client-safe GA referral service labels and toggle filtering (no server imports). */

/** All GA referral form service labels (toggle-gated options filtered at runtime). */
export const GA_REFERRAL_SERVICE_LABELS = [
  "Workplace Readiness Training",
  "Individual Job Placement",
  "Job Coaching",
  "Traditional Supported Employment",
] as const;

/** GA public website referral form — always-on service options (WRT + IJP). */
export const GA_WEBSITE_REFERRAL_SERVICES = [
  "Workplace Readiness Training",
  "Individual Job Placement",
] as const;

export function filterGaReferralServiceLabels(
  labels: readonly string[],
  toggles: {
    jobCoachingEnabled: boolean;
  }
): string[] {
  return labels.filter((label) => {
    const n = label.toLowerCase();
    if (n.includes("job coaching")) {
      return toggles.jobCoachingEnabled;
    }
    return true;
  });
}
