import { createServerClient, isEsRole } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

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
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isEsRole(session.effectiveRole)) {
    throw new Error("Forbidden");
  }

  let admin: SupabaseClient;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new Error("Server configuration error");
  }

  const assigned = await esIsAssignedToClient(session.effectiveUserId, clientId);
  if (!assigned) {
    throw new Error("Client not assigned to you");
  }

  const supabase = await createServerClient();
  return { session, supabase, admin, userId: session.effectiveUserId };
}
