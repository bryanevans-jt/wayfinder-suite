import type { SupabaseClient } from "@supabase/supabase-js";
import type { ServiceSelectOptions } from "@wayfinder/branding";

export type ServiceOfferings = {
  customizedSupportedEmploymentEnabled: boolean;
};

export async function loadServiceOfferings(
  admin: SupabaseClient
): Promise<ServiceOfferings> {
  const { data } = await admin
    .from("admin_config")
    .select("customized_supported_employment_enabled")
    .limit(1)
    .maybeSingle();

  return {
    customizedSupportedEmploymentEnabled:
      data?.customized_supported_employment_enabled === true,
  };
}

export function toServiceSelectOptions(
  offerings: ServiceOfferings
): ServiceSelectOptions {
  return {
    includeCustomizedSupportedEmployment:
      offerings.customizedSupportedEmploymentEnabled,
  };
}
