import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { issueReusableSignInToken } from "@wayfinder/supabase/reusable-signin-token";
import { isJoshuaTreeEmail } from "@wayfinder/supabase/referral-intake";
import { STAFF_APP_PRODUCT_NAME } from "@wayfinder/branding";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import { staffAppOrigin } from "@/lib/portal-staff-users";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/** External (e.g. GVRA) counselor emails use multi-use links; Joshua Tree staff keep Supabase OTP. */
export function shouldUseReusableStaffSignIn(email: string): boolean {
  const flag = (process.env.STAFF_REUSABLE_SIGNIN_LINKS ?? "true").trim().toLowerCase();
  if (flag === "0" || flag === "false" || flag === "no") {
    return false;
  }
  return !isJoshuaTreeEmail(email);
}

export async function sendStaffReusableSignInEmail(
  admin: AdminClient,
  opts: { email: string; authUserId: string }
): Promise<void> {
  const { plainToken, ttlDays } = await issueReusableSignInToken(admin, {
    authUserId: opts.authUserId,
    email: opts.email,
  });

  const link = `${staffAppOrigin()}/auth/access?token=${encodeURIComponent(plainToken)}`;
  const subject = `Your ${STAFF_APP_PRODUCT_NAME} sign-in link`;
  const text = `Hello,

Use this link to sign in to ${STAFF_APP_PRODUCT_NAME}:

${link}

This link stays active for ${ttlDays} day${ttlDays === 1 ? "" : "s"} and can be used more than once (for example if your agency email scanner opens it, or you need to try again later). For your security, do not forward it to others.

If you did not request this email, you can ignore it.

Joshua Tree Wayfinder`;

  const auth = await getGoogleAuth();
  await sendEmail(auth, {
    to: opts.email.trim().toLowerCase(),
    subject,
    text,
  });
}
