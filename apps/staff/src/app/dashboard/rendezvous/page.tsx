import { buildRendezvousAppUrl } from "@wayfinder/branding";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { loadFeatureToggles } from "@/lib/feature-toggles";
import { notFound, redirect } from "next/navigation";

function canEnterRendezvous(opts: {
  role: string | null;
  openToAll: boolean;
}): boolean {
  if (isSuperAdminRole(opts.role)) return true;
  if (!opts.openToAll) return false;
  return (
    isFieldSpecialistRole(opts.role) ||
    isSupervisorRole(opts.role) ||
    isAdminTierRole(opts.role)
  );
}

/**
 * Entry point into the Rendezvous app.
 * Hidden (404) when the org flag is off or the caller is outside the allowed audience.
 */
export default async function RendezvousEntryPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!session) {
    notFound();
  }

  const admin = createServiceRoleClient();
  const toggles = await loadFeatureToggles(admin);
  if (!toggles.rendezvousEnabled) {
    notFound();
  }
  if (!canEnterRendezvous({ role, openToAll: toggles.rendezvousOpenToAll })) {
    notFound();
  }

  redirect(buildRendezvousAppUrl("/"));
}
