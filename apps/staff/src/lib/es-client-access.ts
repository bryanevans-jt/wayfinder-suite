import { createServerClient, isEsRole } from "@wayfinder/supabase";
import { assertNotPreviewMutation, getAppSession } from "@wayfinder/supabase/preview-server";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

/** Confirms the signed-in ES is assigned to the client (service-role lookup avoids RLS gaps). */
export async function assertEsAssignedToClient(clientId: string) {
  await assertNotPreviewMutation();
  const session = await getAppSession();
  if (!session || !isEsRole(session.effectiveRole)) {
    throw new Error("Forbidden");
  }

  const assigned = await esIsAssignedToClient(session.effectiveUserId, clientId);
  if (!assigned) {
    throw new Error("Client not assigned to you");
  }

  const supabase = await createServerClient();
  return { session, supabase, userId: session.effectiveUserId };
}
