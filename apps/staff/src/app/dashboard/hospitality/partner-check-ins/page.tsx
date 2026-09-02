import {
  canLogHospitalityCheckIns,
  canViewHospitalityWorkspace,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { HospitalityPartnerCheckInsWorkspace } from "@/components/hospitality-partner-check-ins-workspace";

export default async function HospitalityPartnerCheckInsPage() {
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
      <h1 className="text-2xl font-bold text-brand-green">Partner Check-ins</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        {canWrite
          ? "Contact every Community Partner at least once each calendar month (Eastern Time). Use Community Partners for the full directory and map."
          : "Review monthly Community Partner outreach. Logging is available to Hospitality Specialist and Admin."}
      </p>
      <HospitalityPartnerCheckInsWorkspace canWrite={canWrite} />
    </main>
  );
}
