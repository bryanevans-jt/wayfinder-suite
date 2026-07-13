import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { isHrRole, isAdminTierRole } from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { HrWorkspace } from "@/components/hr-workspace";
import { loadHrRegistry } from "@/lib/hr-registry-data";

type PageProps = {
  searchParams: Promise<{
    office?: string;
    es?: string;
    client?: string;
    state?: string;
    from?: string;
    to?: string;
    tab?: string;
  }>;
};

export default async function HrDashboardPage({ searchParams }: PageProps) {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole ?? "";
  if (!isHrRole(role) && !isAdminTierRole(role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    redirect("/dashboard");
  }

  const data = await loadHrRegistry(admin, {
    officeId: params.office,
    esUserId: params.es,
    clientId: params.client,
    state: params.state,
    dateFrom: params.from,
    dateTo: params.to,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">HR Dashboard</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        View-only access to the full client roster, timesheets, activity logs, and staff
        assignments.
      </p>
      <HrWorkspace
        clients={data.clients}
        offices={data.offices}
        esUsers={data.esUsers}
        states={data.states}
        supervisorEsLinks={data.supervisorEsLinks}
        esClientLinks={data.esClientLinks}
        staffOfficeLinks={data.staffOfficeLinks}
        initial={{
          officeId: params.office ?? "",
          esUserId: params.es ?? "",
          clientId: params.client ?? "",
          state: params.state ?? "",
          from: params.from ?? "",
          to: params.to ?? "",
          tab: params.tab ?? "clients",
        }}
      />
    </main>
  );
}
