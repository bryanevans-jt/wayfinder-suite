import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { clientInSupervisorScope, loadSupervisorScope } from "@/lib/supervisor-client-scope";

export async function canAccessIjpClientSignature(
  admin: SupabaseClient,
  opts: { role: string; userId: string; clientId: string }
): Promise<boolean> {
  if (isAdminTierRole(opts.role)) return true;

  const { data: client } = await admin
    .from("clients")
    .select("es_user_id, office_id")
    .eq("id", opts.clientId)
    .maybeSingle();
  if (!client) return false;

  if (isFieldSpecialistRole(opts.role)) {
    if ((client.es_user_id as string) === opts.userId) return true;
    return esIsAssignedToClient(opts.userId, opts.clientId);
  }

  if (isSupervisorRole(opts.role)) {
    if (await esIsAssignedToClient(opts.userId, opts.clientId)) return true;
    const scope = await loadSupervisorScope(admin, opts.userId);
    return clientInSupervisorScope(admin, scope, opts.clientId);
  }

  return false;
}
