import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { resolveAuthUserIdByEmail } from "@wayfinder/supabase";
import { isEsRole } from "@wayfinder/supabase/roles";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/** Org-wide Employment Specialist supervisor (CEO admin). */
export const ORG_ES_SUPERVISOR_EMAIL = "ryan.herrington@thejoshuatree.org";

export async function resolveOrgEsSupervisorUserId(
  admin: AdminClient
): Promise<string | null> {
  return resolveAuthUserIdByEmail(admin, ORG_ES_SUPERVISOR_EMAIL.trim().toLowerCase());
}

/** Link one active ES to Ryan; no-op for other roles or missing supervisor account. */
export async function ensureOrgEsSupervisorAssignment(
  admin: AdminClient,
  esUserId: string
): Promise<void> {
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", esUserId)
    .maybeSingle();

  if (!profile || !isEsRole(profile.role as string) || profile.is_active === false) {
    return;
  }

  const supervisorId = await resolveOrgEsSupervisorUserId(admin);
  if (!supervisorId || supervisorId === esUserId) {
    return;
  }

  const { error } = await admin.from("supervisor_es_assignments").insert({
    supervisor_user_id: supervisorId,
    es_user_id: esUserId,
  });

  if (error && !/duplicate|unique/i.test(error.message)) {
    throw new Error(error.message);
  }
}
