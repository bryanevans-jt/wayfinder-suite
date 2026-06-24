import { ComplianceCalendarWorkspace } from "@/components/compliance-calendar-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";
import { loadComplianceCalendar } from "@/lib/operations-data";

export default async function ComplianceCalendarPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (
    !session ||
    (!isSupervisorRole(role) && !isAdminTierRole(role))
  ) {
    redirect("/dashboard");
  }

  const data = await loadComplianceCalendar(role!, session.effectiveUserId);

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Compliance calendar</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        Open SE Monthly report gaps and operational timesheets awaiting approval — scoped to your
        role.
      </p>
      <ComplianceCalendarWorkspace reports={data.reports} timesheets={data.timesheets} />
    </main>
  );
}
