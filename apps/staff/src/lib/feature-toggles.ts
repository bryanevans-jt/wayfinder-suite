import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceSelectOptions } from "@wayfinder/branding";

export type FeatureToggles = {
  communityPartnersEnabled: boolean;
  traditionalSupportedEmploymentEnabled: boolean;
  jobCoachingEnabled: boolean;
  customizedSupportedEmploymentEnabled: boolean;
  groupmeCelebrationsEnabled: boolean;
  celebrationBirthdayTemplate: string;
  celebrationAnniversaryTemplate: string;
};

export const DEFAULT_BIRTHDAY_TEMPLATE =
  "Happy Birthday, {first_name}! Hope you have a fantastic day!";
export const DEFAULT_ANNIVERSARY_TEMPLATE =
  "Today {name} celebrates {years} years at Joshua Tree! Happy work anniversary, {first_name}!";

const TOGGLE_SELECT =
  "community_partners_enabled, traditional_supported_employment_enabled, job_coaching_enabled, customized_supported_employment_enabled, groupme_celebrations_enabled, celebration_birthday_template, celebration_anniversary_template";

export async function loadFeatureToggles(admin: SupabaseClient): Promise<FeatureToggles> {
  const { data } = await admin.from("admin_config").select(TOGGLE_SELECT).limit(1).maybeSingle();

  return {
    communityPartnersEnabled: data?.community_partners_enabled === true,
    traditionalSupportedEmploymentEnabled:
      data?.traditional_supported_employment_enabled === true,
    jobCoachingEnabled: data?.job_coaching_enabled === true,
    customizedSupportedEmploymentEnabled:
      data?.customized_supported_employment_enabled === true,
    groupmeCelebrationsEnabled: data?.groupme_celebrations_enabled !== false,
    celebrationBirthdayTemplate:
      (data?.celebration_birthday_template as string | null)?.trim() ||
      DEFAULT_BIRTHDAY_TEMPLATE,
    celebrationAnniversaryTemplate:
      (data?.celebration_anniversary_template as string | null)?.trim() ||
      DEFAULT_ANNIVERSARY_TEMPLATE,
  };
}

/** @deprecated Prefer loadFeatureToggles */
export async function loadServiceOfferings(admin: SupabaseClient) {
  const t = await loadFeatureToggles(admin);
  return {
    customizedSupportedEmploymentEnabled: t.customizedSupportedEmploymentEnabled,
  };
}

export function toServiceSelectOptions(toggles: FeatureToggles): ServiceSelectOptions {
  return {
    includeCustomizedSupportedEmployment: toggles.customizedSupportedEmploymentEnabled,
    includeTraditionalSupportedEmployment: toggles.traditionalSupportedEmploymentEnabled,
    includeJobCoaching: toggles.jobCoachingEnabled,
  };
}

export function filterGaReferralServiceLabels(
  labels: readonly string[],
  toggles: Pick<
    FeatureToggles,
    "traditionalSupportedEmploymentEnabled" | "jobCoachingEnabled"
  >
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
