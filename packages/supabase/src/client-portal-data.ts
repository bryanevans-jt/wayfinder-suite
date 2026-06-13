import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "./admin-server";
import { resolveDashboardClient, type DashboardClientContext } from "./dashboard-client";

export type ClientPortalDataAccess = {
  ctx: DashboardClientContext;
  /** Service-role client for reads/writes after portal context is verified. */
  admin: SupabaseClient;
};

/** Resolves portal client context with the user session, then returns a service-role client for data reads. */
export async function resolveClientPortalDataAccess(
  supabase: SupabaseClient,
  userId: string,
  role: string | null | undefined,
  selectedClientId?: string
): Promise<ClientPortalDataAccess | null> {
  const ctx = await resolveDashboardClient(supabase, userId, role, selectedClientId);
  if (!ctx) {
    return null;
  }

  let admin: SupabaseClient;
  try {
    admin = createServiceRoleClient();
  } catch {
    admin = supabase;
  }

  return { ctx, admin };
}
