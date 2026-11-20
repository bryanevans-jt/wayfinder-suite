import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canAccessBillableHoursPage } from "@wayfinder/supabase/staff-time-clock-shared";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BillableHoursMonthlyOversight } from "@/components/billable-hours-monthly-oversight";
import { MyBillableHoursWorkspace } from "@/components/my-billable-hours-workspace";
import { MyKraBillableExpectationCard } from "@/components/my-kra-billable-expectation-card";
import { canViewPayrollMonthlyBillableHours } from "@/lib/billable-hours-payroll-access";
import {
  isFieldSpecialistRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { currentMonthKey } from "@/lib/es-time-data";
import { TimesheetWorkspace } from "@/components/timesheet-workspace";
import { loadMyBillableHoursSummary } from "@/lib/es-time-data";
import {
  canAccessWeeklyTimesheetSection,
  loadTimesheetSection,
} from "@/lib/load-timesheet-section";

type PageProps = {
  searchParams: Promise<{ month?: string; week?: string; es?: string; client?: string }>;
};

export default async function MyBillableHoursPage({ searchParams }: PageProps) {
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

  const params = await searchParams;
  const esUserId = session.effectiveUserId;
  const summary = await loadMyBillableHoursSummary(admin, esUserId);
  const showTimesheet = canAccessWeeklyTimesheetSection(role);
  const showPayrollMonthly = canViewPayrollMonthlyBillableHours(role);
  const canCloseKraMonth = isSuperAdminRole(role);
  const monthKey = currentMonthKey();
  const showOwnKraCard = isFieldSpecialistRole(role) || isSupervisorRole(role);

  const timesheetLoad = showTimesheet
    ? await loadTimesheetSection(admin, {
        role: role ?? "",
        effectiveUserId: session.effectiveUserId,
        isPreviewing: session.isPreviewing,
        params,
      })
    : { kind: "hidden" as const };

  if (timesheetLoad.kind === "redirect") {
    redirect(timesheetLoad.url);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">Billable Hours</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Billable service time for this week, last week, and month-to-date (America/New_York), shown
        in hours to one decimal. Totals include logged time whether or not the client was marked
        present; only Case File Review and note-only contact are excluded. Use the monthly timesheet
        below for clients, services, and contact-log detail. Paid time off is under{" "}
        <Link href="/dashboard/pto" className="font-medium text-brand-green underline">
          PTO
        </Link>
        .
      </p>
      <MyBillableHoursWorkspace
        summary={summary}
        showTimesheetLink={false}
        showTeamTimesheetLink={false}
      />
      {showOwnKraCard ? <MyKraBillableExpectationCard initialMonthKey={monthKey} /> : null}
      {showPayrollMonthly ? (
        <BillableHoursMonthlyOversight
          initialMonthKey={monthKey}
          canCloseKraMonth={canCloseKraMonth}
        />
      ) : null}
      {timesheetLoad.kind === "ready" ? (
        <div id="monthly-timesheet" className="scroll-mt-6">
          <TimesheetWorkspace {...timesheetLoad.props} />
        </div>
      ) : null}
    </main>
  );
}
