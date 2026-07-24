import { weekEndSaturday, weekStartSunday } from "@wayfinder/supabase/es-time-tracking";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { TimesheetWorkspace } from "@/components/timesheet-workspace";
import {
  loadEsCaseloadClientOptions,
  loadEsTimeEntriesForWeek,
  loadPendingWeekSubmissionsForSupervisor,
  loadStaffEsPickerOptions,
  loadWeekSubmission,
} from "@/lib/es-time-data";
import { loadStaffNameById } from "@/lib/operations-data";
import { esUserAllowedForSupervisor, loadSupervisorScope } from "@/lib/supervisor-client-scope";

type PageProps = {
  searchParams: Promise<{ week?: string; es?: string; client?: string }>;
};

export default async function TimesheetPage({ searchParams }: PageProps) {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole;
  const canAccess =
    isEsRole(role) ||
    isSupervisorRole(role) ||
    role === "accountant" ||
    role === "hr" ||
    isAdminTierRole(role);

  if (!canAccess) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const weekStart = weekStartSunday(params.week ?? new Date());
  const weekEnd = weekEndSaturday(weekStart);

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    redirect("/dashboard");
  }

  const canPickEs =
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    role === "accountant" ||
    role === "hr";

  const esPickerOptions =
    canPickEs && !isEsRole(role)
      ? await loadStaffEsPickerOptions(admin, role ?? "", session.effectiveUserId)
      : [];

  let esUserId = session.effectiveUserId;

  if (canPickEs && !isEsRole(role)) {
    if (params.es) {
      esUserId = params.es;
    } else if (esPickerOptions.length > 0) {
      const qs = new URLSearchParams({ es: esPickerOptions[0]!.id, week: weekStart });
      if (params.client) {
        qs.set("client", params.client);
      }
      redirect(`/dashboard/timesheet?${qs.toString()}`);
    }
  }

  if (isSupervisorRole(role) && !isAdminTierRole(role) && params.es) {
    const scope = await loadSupervisorScope(admin, session.effectiveUserId);
    if (!esUserAllowedForSupervisor(scope, esUserId)) {
      redirect("/dashboard/timesheet");
    }
  }

  const [esNames, entries, weekSubmission, pendingApprovals, caseloadClients] =
    await Promise.all([
      loadStaffNameById(admin, [esUserId], "Employment Specialist"),
      loadEsTimeEntriesForWeek(admin, esUserId, weekStart),
      loadWeekSubmission(admin, esUserId, weekStart),
      isSupervisorRole(role) || isAdminTierRole(role)
        ? loadPendingWeekSubmissionsForSupervisor(admin, session.effectiveUserId)
        : Promise.resolve([]),
      canPickEs && !isEsRole(role)
        ? loadEsCaseloadClientOptions(admin, esUserId)
        : Promise.resolve([]),
    ]);

  const esName = esNames.get(esUserId) ?? "Employment Specialist";

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">Timesheet</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        Track billable hours tied to client work. Time is captured when you log contacts,
        applications, meetings, and stage updates using the simplified activity list. Submit each
        pay week (Sunday–Saturday) for supervisor approval.
      </p>
      <TimesheetWorkspace
        role={role ?? ""}
        esUserId={esUserId}
        esName={esName}
        weekStart={weekStart}
        weekEnd={weekEnd}
        entries={entries}
        weekSubmission={weekSubmission}
        pendingApprovals={pendingApprovals}
        readOnly={session.isPreviewing}
        supervisedEsOptions={esPickerOptions}
        caseloadClients={caseloadClients}
        initialClientFilter={params.client ?? ""}
        canPickEs={canPickEs && !isEsRole(role)}
      />
    </main>
  );
}
