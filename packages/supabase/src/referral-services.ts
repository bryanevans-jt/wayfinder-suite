/** Client-safe GA referral service labels and toggle filtering (no server imports). */

/** All GA referral form service labels (toggle-gated options filtered at runtime). */
export const GA_REFERRAL_SERVICE_LABELS = [
  "Traditional Supported Employment",
  "Job Coaching",
  "Individual Job Placement",
  "Workplace Readiness Training",
] as const;

/** GA public website referral form — always-on service options (IJP + WRT). */
export const GA_WEBSITE_REFERRAL_SERVICES = [
  "Individual Job Placement",
  "Workplace Readiness Training",
] as const;

export function filterGaReferralServiceLabels(
  labels: readonly string[],
  toggles: {
    traditionalSupportedEmploymentEnabled: boolean;
    jobCoachingEnabled: boolean;
  }
): string[] {
  return labels.filter((label) => {
    const n = label.toLowerCase();
    if (n.includes("traditional supported employment") || n === "supported employment") {
      return toggles.traditionalSupportedEmploymentEnabled;
    }
    if (n.includes("job coaching")) {
      return toggles.jobCoachingEnabled;
    }
    return true;
  });
}
