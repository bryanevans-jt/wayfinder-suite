import { ComplianceCalendarWorkspace } from "@/components/compliance-calendar-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isSuperAdminRole,
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
  const orgWide = isAdminTierRole(role);

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Compliance Calendar</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        {isSuperAdminRole(role)
          ? "Organization-wide missing and overdue official report alerts (all report types)."
          : isAdminTierRole(role)
            ? "Organization-wide open GVRA report alerts."
            : "Open report alerts for clients and specialists in your supervisor scope."}
      </p>
      <ComplianceCalendarWorkspace reports={data.reports} orgWide={orgWide} />
    </main>
  );
}
