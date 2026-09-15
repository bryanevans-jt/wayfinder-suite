import { syncCounselorPortalLoginForEmail } from "@/lib/portal-staff-users";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { isJoshuaTreeEmail } from "@wayfinder/supabase/referral-intake";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleWayfinderAuthCallback(request, {
    requireProvisionedProfile: true,
    prepareAuthenticatedUser: async ({ email }) => {
      const normalized = email?.trim().toLowerCase() ?? "";
      if (!normalized.includes("@") || isJoshuaTreeEmail(normalized)) {
        return;
      }
      const admin = createServiceRoleClient();
      const result = await syncCounselorPortalLoginForEmail(admin, normalized, {
        sendInvite: false,
      });
      if (result.notRegisteredMessage) {
        return { error: "not_set_up", reason: result.notRegisteredMessage };
      }
    },
    onAuthenticated: async ({ userId, email }) => {
      const admin = createServiceRoleClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      const home = staffHomePath(profile?.role as string | undefined);
      return home !== "/dashboard" ? home : undefined;
    },
  });
}
