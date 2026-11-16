import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAccountantRole,
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { clientInSupervisorScope, loadSupervisorScope } from "@/lib/supervisor-client-scope";

/** Accounts Specialist / Admin may choose which open capture month a signature applies to. */
export function canPickIjpAttestationMonth(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isAccountantRole(role);
}

export async function canAccessIjpClientSignature(
  admin: SupabaseClient,
  opts: { role: string; userId: string; clientId: string }
): Promise<boolean> {
  if (isAdminTierRole(opts.role) || isAccountantRole(opts.role)) return true;

  const { data: client } = await admin
    .from("clients")
    .select("id")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!client) return false;

  if (isFieldSpecialistRole(opts.role)) {
    // Assignment lives on es_client_assignments — clients has no es_user_id column.
    return esIsAssignedToClient(opts.userId, opts.clientId);
  }

  if (isSupervisorRole(opts.role)) {
    if (await esIsAssignedToClient(opts.userId, opts.clientId)) return true;
    const scope = await loadSupervisorScope(admin, opts.userId);
    return clientInSupervisorScope(admin, scope, opts.clientId);
  }

  return false;
}
