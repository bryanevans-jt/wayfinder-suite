import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isStaffRole } from "@wayfinder/supabase/roles";
import { loadFeatureToggles } from "@/lib/feature-toggles";
import { NextResponse } from "next/server";

/** Authenticated staff: four service/network booleans only (no celebration templates). */
export async function GET() {
  const session = await getAppSession();
  if (!session || !isStaffRole(session.effectiveRole)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const toggles = await loadFeatureToggles(admin);

  return NextResponse.json({
    community_partners_enabled: toggles.communityPartnersEnabled,
    traditional_supported_employment_enabled: toggles.traditionalSupportedEmploymentEnabled,
    job_coaching_enabled: toggles.jobCoachingEnabled,
    customized_supported_employment_enabled: toggles.customizedSupportedEmploymentEnabled,
  });
}
