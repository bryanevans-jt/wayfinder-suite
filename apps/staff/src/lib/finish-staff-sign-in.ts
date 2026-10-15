import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isJoshuaTreeEmail } from "@wayfinder/supabase/referral-intake";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { syncCounselorPortalLoginForEmail } from "@/lib/portal-staff-users";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

export type FinishStaffSignInResult =
  | { ok: true; redirectPath: string }
  | { ok: false; errorCode: string; reason?: string };

export async function finishStaffSignInAfterAuth(
  admin: AdminClient,
  opts: { userId: string; email: string | null }
): Promise<FinishStaffSignInResult> {
  const normalized = opts.email?.trim().toLowerCase() ?? "";

  if (normalized.includes("@") && !isJoshuaTreeEmail(normalized)) {
    const sync = await syncCounselorPortalLoginForEmail(admin, normalized, {
      sendInvite: false,
    });
    if (sync.notRegisteredMessage) {
      return { ok: false, errorCode: "not_set_up", reason: sync.notRegisteredMessage };
    }
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", opts.userId)
    .maybeSingle();

  if (!profile?.id) {
    return { ok: false, errorCode: "not_set_up" };
  }

  const home = staffHomePath(profile.role as string | undefined);
  return { ok: true, redirectPath: home.startsWith("/") ? home : "/dashboard" };
}
