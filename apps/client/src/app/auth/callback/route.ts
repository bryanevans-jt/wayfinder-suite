import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { ensureClientAuthProfile } from "@wayfinder/supabase";
import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleWayfinderAuthCallback(request, {
    requireProvisionedProfile: true,
    onAuthenticated: async ({ userId, email }) => {
      const admin = createServiceRoleClient();
      await ensureClientAuthProfile(admin, userId, email);
    },
  });
}
