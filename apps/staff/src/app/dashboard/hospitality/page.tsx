import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  canViewHospitalityWorkspace,
  isHrRole,
  staffHomePath,
} from "@wayfinder/supabase/roles";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { redirect } from "next/navigation";
import { HospitalityWorkspace } from "@/components/hospitality-workspace";
import { loadHrRegistry } from "@/lib/hr-registry-data";

export default async function HospitalityDashboardPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const role = session.effectiveRole ?? "";
  if (!canViewHospitalityWorkspace(role)) {
    redirect(staffHomePath(role));
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    redirect(staffHomePath(role));
  }

  const data = await loadHrRegistry(admin, {});

  let employers: Array<{
    id: string;
    name: string;
    status: string;
    city: string | null;
    state: string | null;
  }> = [];
  try {
    const { data: employerRows } = await admin
      .from("employers")
      .select("id, name, status, city, state")
      .order("name")
      .limit(500);
    employers = (employerRows ?? []).map((e) => ({
      id: e.id as string,
      name: e.name as string,
      status: ((e.status as string | null) ?? "unknown") as string,
      city: (e.city as string | null) ?? null,
      state: (e.state as string | null) ?? null,
    }));
  } catch {
    employers = [];
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-brand-green">Hospitality Specialist</h1>
      <p className="mt-2 max-w-2xl text-sm text-brand-black/75">
        View client activity, Community Network members (including pending), and org connections.
        Use Weekly Check-ins for client wellness calls and Partner Check-ins for monthly Community
        Partner outreach. Open a client to add internal staff notes.
        {isHrRole(role)
          ? " HR can review this workspace; Hospitality Specialist logs check-ins and staff notes."
          : ""}
      </p>
      <HospitalityWorkspace
        clients={data.clients}
        employers={employers}
        supervisorEsLinks={data.supervisorEsLinks}
        esClientLinks={data.esClientLinks}
        staffOfficeLinks={data.staffOfficeLinks}
      />
    </main>
  );
}
