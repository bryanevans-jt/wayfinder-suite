import { ReferralQueueWorkspace } from "@/components/referral-queue-workspace";
import { canManageReferrals } from "@wayfinder/supabase/referral-intake";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function ReferralsPage() {
  const session = await getAppSession();
  if (!session || !canManageReferrals(session.effectiveRole)) {
    redirect(staffHomePath(session?.effectiveRole ?? null));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Referral Queue</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        New and pending referrals from the GA and TN website forms. Review details, set
        authorization, then activate to the first service stage.
      </p>
      <ReferralQueueWorkspace />
    </main>
  );
}
