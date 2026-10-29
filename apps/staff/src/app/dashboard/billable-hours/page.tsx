import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { canUseStaffPto } from "@wayfinder/supabase/staff-pto-shared";
import { canAccessBillableHoursPage } from "@wayfinder/supabase/staff-time-clock-shared";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { BillableHoursPayrollMonthlyPanel } from "@/components/billable-hours-payroll-monthly-panel";
import { MyBillableHoursWorkspace } from "@/components/my-billable-hours-workspace";
import { BillableHoursKraCompliancePanel } from "@/components/billable-hours-kra-compliance-panel";
import { canViewPayrollMonthlyBillableHours } from "@/lib/billable-hours-payroll-access";
import { isSuperAdminRole } from "@wayfinder/supabase/roles";
import { defaultPayrollMonthKey } from "@/lib/es-time-data";
import { StaffPtoPanel } from "@/components/staff-pto-panel";
import { TimesheetWorkspace } from "@/components/timesheet-workspace";
import { loadMyBillableHoursSummary } from "@/lib/es-time-data";
import {
  canAccessWeeklyTimesheetSection,
  loadTimesheetSection,
} from "@/lib/load-timesheet-section";

type PageProps = {
  searchParams: Promise<{ week?: string; es?: string; client?: string }>;
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
  const showPto = canUseStaffPto(role);
  const showPayrollMonthly = canViewPayrollMonthlyBillableHours(role);
  const showKraCompliance = showPayrollMonthly;
  const canCloseKraMonth = isSuperAdminRole(role);
  const payrollMonthKey = defaultPayrollMonthKey();

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
        present; only Case File Review and note-only contact are excluded. Use the weekly timesheet
        below for line-by-line review; PTO requests are at the bottom of this page.
      </p>
      <MyBillableHoursWorkspace
        summary={summary}
        showTimesheetLink={false}
        showTeamTimesheetLink={false}
      />
      {showPayrollMonthly ? (
        <BillableHoursPayrollMonthlyPanel initialMonthKey={payrollMonthKey} />
      ) : null}
      {showKraCompliance ? (
        <BillableHoursKraCompliancePanel
          initialMonthKey={payrollMonthKey}
          canCloseMonth={canCloseKraMonth}
        />
      ) : null}
      {timesheetLoad.kind === "ready" ? (
        <div id="weekly-timesheet" className="scroll-mt-6">
          <TimesheetWorkspace {...timesheetLoad.props} />
        </div>
      ) : null}
      {showPto ? (
        <div className="mt-10 border-t border-neutral-200 pt-8">
          <StaffPtoPanel />
        </div>
      ) : null}
    </main>
  );
}
