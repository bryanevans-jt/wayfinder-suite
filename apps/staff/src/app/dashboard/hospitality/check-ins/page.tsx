import {
  canLogHospitalityCheckIns,
  canViewHospitalityWorkspace,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { HospitalityCheckInsWorkspace } from "@/components/hospitality-check-ins-workspace";

export default async function HospitalityCheckInsPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole ?? "";
  if (!canViewHospitalityWorkspace(role)) {
    redirect(staffHomePath(role));
  }

  const canWrite = canLogHospitalityCheckIns(role) && !session.isPreviewing;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">Weekly Check-ins</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        {canWrite
          ? "Call every client at least once each week (Sunday–Saturday, Eastern Time) to see how they are doing and how services are going. Open a client to add internal staff notes."
          : "Review weekly wellness call progress. Logging is available to Hospitality Specialist and Admin."}
      </p>
      <HospitalityCheckInsWorkspace canWrite={canWrite} />
    </main>
  );
}
