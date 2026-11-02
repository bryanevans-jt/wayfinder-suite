import { createServerClient, resolveClientPortalDataAccess } from "@wayfinder/supabase";
import { cache } from "react";

/**
 * Resolve the selected client once per server render. Dashboard sections share
 * this loader instead of repeating the same auth-linked client lookup.
 */
export const getClientDashboardAccess = cache(
  async (
    userId: string,
    role: string,
    selectedClientId?: string
  ) => {
    const supabase = await createServerClient();
    return resolveClientPortalDataAccess(
      supabase,
      userId,
      role,
      selectedClientId
    );
  }
);
