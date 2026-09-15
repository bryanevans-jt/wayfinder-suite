import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceSelectOptions } from "@wayfinder/branding";
export { filterGaReferralServiceLabels } from "@wayfinder/supabase/referral-services";

export type FeatureToggles = {
  communityPartnersEnabled: boolean;
  traditionalSupportedEmploymentEnabled: boolean;
  jobCoachingEnabled: boolean;
  customizedSupportedEmploymentEnabled: boolean;
  groupmeCelebrationsEnabled: boolean;
  celebrationBirthdayTemplate: string;
  celebrationAnniversaryTemplate: string;
  directReferralAssignEnabled: boolean;
};

export const DEFAULT_BIRTHDAY_TEMPLATE =
  "Happy Birthday, {first_name}! Hope you have a fantastic day!";
export const DEFAULT_ANNIVERSARY_TEMPLATE =
  "Today {name} celebrates {years} years at Joshua Tree! Happy work anniversary, {first_name}!";

const TOGGLE_SELECT =
  "community_partners_enabled, traditional_supported_employment_enabled, job_coaching_enabled, customized_supported_employment_enabled, groupme_celebrations_enabled, celebration_birthday_template, celebration_anniversary_template, direct_referral_assign_enabled";

export async function loadFeatureToggles(admin: SupabaseClient): Promise<FeatureToggles> {
  let { data, error } = await admin.from("admin_config").select(TOGGLE_SELECT).limit(1).maybeSingle();

  if (error?.message.includes("direct_referral_assign")) {
    const fallback = await admin
      .from("admin_config")
      .select(
        "community_partners_enabled, traditional_supported_employment_enabled, job_coaching_enabled, customized_supported_employment_enabled, groupme_celebrations_enabled, celebration_birthday_template, celebration_anniversary_template"
      )
      .limit(1)
      .maybeSingle();
    data = fallback.data as typeof data;
    error = fallback.error;
  }

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
    directReferralAssignEnabled: data?.direct_referral_assign_enabled === true,
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
    /** Core GA offering — always in staff service pickers (supervisor portal, clients, referrals). */
    includeTraditionalSupportedEmployment: true,
    includeJobCoaching: toggles.jobCoachingEnabled,
  };
}

