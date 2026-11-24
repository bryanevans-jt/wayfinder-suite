/** Client-safe GA referral service labels and toggle filtering (no server imports). */

/** All GA referral form service labels (toggle-gated options filtered at runtime). */
export const GA_REFERRAL_SERVICE_LABELS = [
  "Workplace Readiness Training",
  "Individual Job Placement",
  "Job Coaching",
  "Traditional Supported Employment",
  "PTS Job Preparation",
  "PTS Job Placement",
] as const;

/** GA public website referral form — always-on service options (plus API-loaded toggle options). */
export const GA_WEBSITE_REFERRAL_SERVICES = [
  "Workplace Readiness Training",
  "Individual Job Placement",
  "PTS Job Preparation",
  "PTS Job Placement",
] as const;

/** Map services.name → GA referral form label for pre-filling returning-client referrals. */
export function gaServiceNameToReferralLabel(serviceName: string | null | undefined): string {
  const n = (serviceName ?? "").trim().toLowerCase();
  if (!n) return "";
  if (n.includes("traditional supported employment")) return "Traditional Supported Employment";
  if (n.includes("job coaching")) return "Job Coaching";
  // Check PTS labels before broader "job placement" / readiness names.
  if (n.includes("pts job preparation")) return "PTS Job Preparation";
  if (n.includes("pts job placement")) return "PTS Job Placement";
  if (n.includes("individual job placement")) return "Individual Job Placement";
  if (n.includes("workplace readiness")) return "Workplace Readiness Training";
  return "";
}

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
      return true;
    }
    if (n.includes("job coaching")) {
      return toggles.jobCoachingEnabled;
    }
    return true;
  });
}
