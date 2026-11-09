import { buildRendezvousAppUrl } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { loadFeatureToggles } from "@/lib/feature-toggles";
import { notFound, redirect } from "next/navigation";

/**
 * Hidden entry point. Returns 404 for anyone who is not a super admin or when
 * the org flag is off — so the feature stays undiscoverable.
 */
export default async function RendezvousEntryPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!session || !isSuperAdminRole(role)) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const toggles = await loadFeatureToggles(admin);
  if (!toggles.rendezvousEnabled) {
    notFound();
  }

  redirect(buildRendezvousAppUrl("/"));
}
