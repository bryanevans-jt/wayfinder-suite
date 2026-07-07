import { createServerClient, isEsRole, isSupervisorRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import {
  clientInSupervisorScope,
  loadSupervisorScope,
} from "@/lib/supervisor-client-scope";

export type EsClientAccess = {
  session: NonNullable<Awaited<ReturnType<typeof getAppSession>>>;
  /** User-scoped client for reads covered by ES RLS policies. */
  supabase: SupabaseClient;
  /** Service-role client for writes after assignment is verified. */
  admin: SupabaseClient;
  userId: string;
};

/** Confirms the signed-in ES is assigned to the client (service-role lookup avoids RLS gaps). */
export async function assertEsAssignedToClient(clientId: string): Promise<EsClientAccess> {
  return assertStaffClientWriteAccess(clientId, { esOnly: true });
}

/** ES assigned to client, or supervisor with scope over the client's caseload. */
export async function assertStaffClientWriteAccess(
  clientId: string,
  options: { esOnly?: boolean } = {}
): Promise<EsClientAccess> {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session) {
    throw new Error("Forbidden");
  }

  let admin: SupabaseClient;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new Error("Server configuration error");
  }

  let allowed = false;

  if (isEsRole(session.effectiveRole)) {
    allowed = await esIsAssignedToClient(session.effectiveUserId, clientId);
  } else if (isSupervisorRole(session.effectiveRole)) {
    if (options.esOnly) {
      allowed = await esIsAssignedToClient(session.effectiveUserId, clientId);
    } else {
      const scope = await loadSupervisorScope(admin, session.effectiveUserId);
      allowed = await clientInSupervisorScope(admin, scope, clientId);
    }
  }

  if (!allowed) {
    throw new Error("Client not assigned to you");
  }

  const supabase = await createServerClient();
  return { session, supabase, admin, userId: session.effectiveUserId };
}
