import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { maybeCompleteSessionDocumentation } from "@wayfinder/supabase/pre-ets-session-attendance";
import { notifyPreEtsSessionCompleted } from "@/lib/pre-ets-session-complete-notify";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

/** Finalize session documentation and notify Accounts + Supervisor when newly completed. */
export async function finalizePreEtsSessionDocumentation(
  admin: AdminClient,
  sessionId: string,
  schoolYear: string
): Promise<boolean> {
  const completed = await maybeCompleteSessionDocumentation(admin, sessionId, schoolYear);
  if (!completed) {
    return false;
  }

  try {
    await notifyPreEtsSessionCompleted(admin, sessionId);
  } catch (err) {
    console.error("pre_ets session completion notify failed:", err);
  }

  return true;
}
