import { syncCounselorPortalLoginForEmail } from "@/lib/portal-staff-users";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { handleWayfinderAuthCallback } from "@wayfinder/supabase/auth-callback";
import { staffHomePath } from "@wayfinder/supabase/roles";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return handleWayfinderAuthCallback(request, {
    requireProvisionedProfile: true,
    onAuthenticated: async ({ userId, email }) => {
      const normalized = email?.trim().toLowerCase() ?? "";
      if (normalized.includes("@")) {
        try {
          const admin = createServiceRoleClient();
          await syncCounselorPortalLoginForEmail(admin, normalized, { sendInvite: false });
        } catch (err) {
          console.error("staff auth callback counselor sync:", err);
        }
      }

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
