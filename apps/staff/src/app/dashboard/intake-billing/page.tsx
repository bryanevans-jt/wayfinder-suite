import { IntakeBillingWorkspace } from "@/components/intake-billing-workspace";
import { canAccessIntakeBilling } from "@wayfinder/supabase/intake-billing";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function IntakeBillingPage() {
  const session = await getAppSession();
  if (!session || !canAccessIntakeBilling(session.effectiveRole)) {
    redirect(staffHomePath(session?.effectiveRole ?? null));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Intake Billing</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Bill the state after the client’s intake meeting, then mark payment received. Employment
        Specialists and supervisors do not see this queue.
      </p>
      <IntakeBillingWorkspace />
    </main>
  );
}
