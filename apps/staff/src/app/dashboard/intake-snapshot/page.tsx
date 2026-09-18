import { CooIntakeSnapshotPanel } from "@/components/coo-intake-snapshot-panel";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { isSuperAdminRole, staffHomePath } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function IntakeSnapshotPage() {
  const session = await getAppSession();
  if (!session || !isSuperAdminRole(session.effectiveRole)) {
    redirect(staffHomePath(session?.effectiveRole ?? null));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Intake &amp; Referral Snapshot</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        Executive view of referral pipeline health, SLA exposure, recent activations, and system
        errors. Times are Eastern US. This does not change live operations—read-only aggregates.
      </p>
      <div className="mt-8 max-w-5xl">
        <CooIntakeSnapshotPanel />
      </div>
    </main>
  );
}
