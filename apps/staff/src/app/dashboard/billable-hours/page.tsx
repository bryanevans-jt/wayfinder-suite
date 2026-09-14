import { weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isHrRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { canAccessBillableHoursPage } from "@wayfinder/supabase/staff-time-clock-shared";
import { canUseStaffPto } from "@wayfinder/supabase/staff-pto-shared";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { MyBillableHoursWorkspace } from "@/components/my-billable-hours-workspace";
import { StaffPtoPanel } from "@/components/staff-pto-panel";
import { loadMyBillableHoursSummary } from "@/lib/es-time-data";

function canOpenWeeklyTimesheet(role: string | null | undefined): boolean {
  return (
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
    isHrRole(role) ||
    isAdminTierRole(role)
  );
}

export default async function MyBillableHoursPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole;
  if (!canAccessBillableHoursPage(role)) {
    redirect("/dashboard");
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    redirect("/dashboard");
  }

  const esUserId = session.effectiveUserId;
  const summary = await loadMyBillableHoursSummary(admin, esUserId);
  const weekStart = weekStartSunday(summary.today);
  const timesheetHref = `/dashboard/timesheet?week=${encodeURIComponent(weekStart)}`;
  const teamTimesheetHref = `/dashboard/timesheet?week=${encodeURIComponent(weekStart)}`;
  const showTimesheet = canOpenWeeklyTimesheet(role);
  const showPto = canUseStaffPto(role);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">Billable Hours</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Client service time totals for this week, last week, and month-to-date (America/New_York).
        Time is captured when you log contacts, applications, meetings, and related work on client
        profiles. Payroll clock-in/out has been replaced by billable timesheets for all staff.
      </p>
      <MyBillableHoursWorkspace
        summary={summary}
        timesheetHref={timesheetHref}
        showTimesheetLink={showTimesheet}
        showTeamTimesheetLink={isSupervisorRole(role) && showTimesheet}
        teamTimesheetHref={teamTimesheetHref}
      />
      {showPto ? <StaffPtoPanel /> : null}
    </main>
  );
}
