import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { canAccessIjpClientSignature } from "@/lib/ijp-field-access";

export async function canDismissIjpAttestationSla(
  admin: SupabaseClient,
  opts: { role: string; userId: string; clientId: string }
): Promise<boolean> {
  if (isAdminTierRole(opts.role)) return true;
  if (!isSupervisorRole(opts.role)) return false;
  return canAccessIjpClientSignature(admin, opts);
}
