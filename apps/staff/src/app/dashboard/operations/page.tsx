import { SupervisorOperationsWorkspace } from "@/components/supervisor-operations-workspace";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";
import { loadCoachingQueue, loadEsCapacityRows } from "@/lib/operations-data";
import { loadOfficeCaseCounts } from "@/lib/office-case-counts";

export default async function OperationsPage() {
  const session = await getAppSession();
  const role = session?.effectiveRole ?? null;

  if (!session || (!isSupervisorRole(role) && !isAdminTierRole(role))) {
    redirect("/dashboard");
  }

  const adminTier = isAdminTierRole(role);
  const [capacity, coaching, officeCaseCounts] = await Promise.all([
    loadEsCapacityRows(role!, session.effectiveUserId),
    isSupervisorRole(role)
      ? loadCoachingQueue(session.effectiveUserId)
      : Promise.resolve({ sla: [], thinLogs: [] }),
    adminTier ? loadOfficeCaseCounts() : Promise.resolve([]),
  ]);

  const clientsPortalBasePath = isSuperAdminRole(role)
    ? "/dashboard/super-admin"
    : "/dashboard/admin";

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="text-2xl font-semibold text-brand-black">Team Operations</h1>
      <p className="mt-2 max-w-3xl text-sm text-brand-black/75">
        Caseload capacity, coaching queue, and billable-hour trends for your team.
      </p>
      <SupervisorOperationsWorkspace
        capacity={capacity}
        coaching={coaching}
        showCoaching={isSupervisorRole(role)}
        showAllStaffRoles={adminTier}
        officeCaseCounts={officeCaseCounts}
        clientsPortalBasePath={clientsPortalBasePath}
      />
    </main>
  );
}
