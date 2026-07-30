import { HospitalityIntakeWorkspace } from "@/components/hospitality-intake-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isHospitalitySpecialistRole,
  isHrRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function HospitalityIntakesPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;
  if (
    !session ||
    (!isHospitalitySpecialistRole(role) && !isHrRole(role) && !isAdminTierRole(role))
  ) {
    redirect(staffHomePath(role));
  }

  return (
    <main className="px-6 py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Intake Calls</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        GA TSE Phase 1 clients needing an intake meeting scheduled. Oldest incomplete stays at the
        top; mark complete when the meeting is set.
      </p>
      <HospitalityIntakeWorkspace />
    </main>
  );
}
