import { weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  isFieldSpecialistRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { MyBillableHoursWorkspace } from "@/components/my-billable-hours-workspace";
import { loadMyBillableHoursSummary } from "@/lib/es-time-data";

export default async function MyBillableHoursPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole;
  const canAccess = isFieldSpecialistRole(role) || isSupervisorRole(role);
  if (!canAccess) {
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

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">My Billable Hours</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Quick totals for state-billable client service time. This is separate from payroll Time
        Clock (not used for Employment Specialists, Transition Specialists, or Supervisors).
      </p>
      <MyBillableHoursWorkspace
        summary={summary}
        timesheetHref={timesheetHref}
        showTeamTimesheetLink={isSupervisorRole(role)}
        teamTimesheetHref={teamTimesheetHref}
      />
    </main>
  );
}
