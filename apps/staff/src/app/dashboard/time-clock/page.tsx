import { StaffTimeClockWorkspace } from "@/components/staff-time-clock-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { canUseStaffClock } from "@wayfinder/supabase/staff-time-clock-shared";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";

export default async function TimeClockPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole ?? null;
  if (!canUseStaffClock(role)) {
    redirect("/dashboard");
  }

  const canViewTeam = isSupervisorRole(role) || isAdminTierRole(role);
  const canEditOthers = canViewTeam;

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Time Clock</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Clock in and out for hours worked (payroll / accountability). This is separate from client
        billable time on Weekly Timesheet. All times use America/New_York.
      </p>
      <StaffTimeClockWorkspace canViewTeam={canViewTeam} canEditOthers={canEditOthers} />
    </main>
  );
}
