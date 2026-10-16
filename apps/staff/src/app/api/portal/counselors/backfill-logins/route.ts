import { assertPortalMutation, jsonPortalError } from "@/lib/portal-auth";
import { backfillAllEligibleCounselorLogins } from "@/lib/portal-staff-users";

export async function POST() {
  try {
    const { admin } = await assertPortalMutation("super_admin");
    const result = await backfillAllEligibleCounselorLogins(admin, { sendInvite: false });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return await jsonPortalError(error);
  }
}
