import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceSelectOptions } from "@wayfinder/branding";
import {
  loadFeatureToggles,
  toServiceSelectOptions as togglesToServiceSelectOptions,
} from "@/lib/feature-toggles";

export type ServiceOfferings = {
  customizedSupportedEmploymentEnabled: boolean;
  traditionalSupportedEmploymentEnabled: boolean;
  jobCoachingEnabled: boolean;
};

/** @deprecated Prefer loadFeatureToggles from feature-toggles.ts */
export async function loadServiceOfferings(
  admin: SupabaseClient
): Promise<ServiceOfferings> {
  const t = await loadFeatureToggles(admin);
  return {
    customizedSupportedEmploymentEnabled: t.customizedSupportedEmploymentEnabled,
    traditionalSupportedEmploymentEnabled: t.traditionalSupportedEmploymentEnabled,
    jobCoachingEnabled: t.jobCoachingEnabled,
  };
}

export function toServiceSelectOptions(
  offerings: ServiceOfferings
): ServiceSelectOptions {
  return togglesToServiceSelectOptions({
    communityPartnersEnabled: false,
    traditionalSupportedEmploymentEnabled: offerings.traditionalSupportedEmploymentEnabled,
    jobCoachingEnabled: offerings.jobCoachingEnabled,
    customizedSupportedEmploymentEnabled: offerings.customizedSupportedEmploymentEnabled,
    groupmeCelebrationsEnabled: true,
    celebrationBirthdayTemplate: "",
    celebrationAnniversaryTemplate: "",
  });
}
