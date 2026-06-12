import { createServerClient, isEsReplyOverdue, isEsRole } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import { clientDisplayName, dedupeServicesForSelect, serviceDisplayName } from "@wayfinder/branding";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  RESPONSIVE_TABLE_CLASS,
  ResponsiveTableShell,
} from "@/components/responsive-table-shell";
import { fetchEsCaseloadClients } from "@/lib/es-caseload-data";
import { AddClientLauncher } from "./add-client-launcher";
import { EsNaturalSupportButton } from "./es-natural-support-button";

export default async function EsClientsPage() {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const effectiveRole = session.effectiveRole;
  const effectiveUserId = session.effectiveUserId;

  if (!isEsRole(effectiveRole)) {
    return (
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
        <p className="mt-2 max-w-xl text-brand-black/80">
          Client management is available to Employer Services (ES) accounts. Your current role
          does not include this workspace.
        </p>
      </main>
    );
  }

  const supabase = await createServerClient();

  const [caseload, servicesQuery, { data: offices }, { data: counselorsRaw }] = await Promise.all([
    fetchEsCaseloadClients(effectiveUserId),
    supabase.from("services").select("id, name, state").order("name", { ascending: true }),
    supabase.from("offices").select("id, name").order("name", { ascending: true }),
    supabase
      .from("counselors")
      .select("id, full_name, office_id, offices(name)")
      .order("full_name", { ascending: true }),
  ]);

  let servicesRaw: Array<{ id: string; name: string; state?: string | null }> =
    (servicesQuery.data ?? []) as Array<{ id: string; name: string; state?: string | null }>;
  if (servicesQuery.error?.message.includes("state")) {
    const fallback = await supabase.from("services").select("id, name").order("name", {
      ascending: true,
    });
    servicesRaw = (fallback.data ?? []) as Array<{
      id: string;
      name: string;
      state?: string | null;
    }>;
  }

  const services = dedupeServicesForSelect(servicesRaw);

  if (caseload.error) {
    return (
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
        <p className="mt-2 text-sm text-red-700">{USER_FACING_SYSTEM_ERROR}</p>
      </main>
    );
  }

  const clients = caseload.clients;

  const profileIds = [
    ...new Set(clients.map((c) => c.user_id ?? c.profile_id).filter(Boolean)),
  ] as string[];
  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const serviceIds = [...new Set(clients.map((c) => c.current_service_id).filter(Boolean))] as string[];
  let serviceRowsResolved: Array<{ id: string; name: string; state?: string | null }> = [];
  if (serviceIds.length > 0) {
    const serviceQuery = await supabase
      .from("services")
      .select("id, name, state")
      .in("id", serviceIds);
    if (serviceQuery.error?.message.includes("state")) {
      const fallback = await supabase.from("services").select("id, name").in("id", serviceIds);
      serviceRowsResolved = (fallback.data ?? []) as Array<{
        id: string;
        name: string;
        state?: string | null;
      }>;
    } else {
      serviceRowsResolved = (serviceQuery.data ?? []) as Array<{
        id: string;
        name: string;
        state?: string | null;
      }>;
    }
  }

  const serviceName = new Map(
    serviceRowsResolved.map((s) => [
      s.id,
      serviceDisplayName({ id: s.id, name: s.name, state: s.state ?? null }),
    ])
  );

  const stageIds = [...new Set(clients.map((c) => c.current_stage_id).filter(Boolean))] as string[];
  const { data: stageRows } =
    stageIds.length > 0
      ? await supabase.from("service_milestones").select("id, title").in("id", stageIds)
      : { data: [] as { id: string; title: string }[] };

  const stageTitle = new Map((stageRows ?? []).map((m) => [m.id, m.title]));

  const { data: messageThreads } = await supabase
    .from("client_message_threads")
    .select("client_id, last_client_message_at, last_es_message_at")
    .eq("current_es_user_id", effectiveUserId);

  const overdueByClient = new Map<string, boolean>();
  for (const t of messageThreads ?? []) {
    if (t.client_id && isEsReplyOverdue(t.last_client_message_at as string, t.last_es_message_at as string)) {
      overdueByClient.set(t.client_id as string, true);
    }
  }

  const counselors =
    (counselorsRaw ?? []).map((c) => {
      const rawOffices = (c as { offices?: { name: string } | { name: string }[] | null })
        .offices;
      const officesEmbed = Array.isArray(rawOffices)
        ? (rawOffices[0] ?? null)
        : (rawOffices ?? null);
      return {
        id: c.id as string,
        full_name: c.full_name as string,
        office_id: c.office_id as string,
        offices: officesEmbed,
      };
    }) ?? [];

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/75">
            Everyone listed here is assigned to you. Open a row to update their current stage.
          </p>
        </div>
        {!session.isPreviewing ? (
          <AddClientLauncher
            services={services}
            offices={(offices ?? []) as { id: string; name: string }[]}
            counselors={counselors}
          />
        ) : null}
      </div>

      <ResponsiveTableShell className="mt-8">
        <table className={RESPONSIVE_TABLE_CLASS}>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-semibold text-brand-black">Name</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Current service</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Current stage</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Messages</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Support</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-black/70">
                  No clients assigned yet. Use <span className="font-semibold text-brand-black">Add client</span>{" "}
                  to create one.
                </td>
              </tr>
            ) : (
              clients.map((c) => {
                const profileId = c.user_id ?? c.profile_id;
                const name = clientDisplayName({
                  full_name: (profileId ? profileName.get(profileId) : null) ?? null,
                  contact_email: c.contact_email,
                  id: c.id,
                });
                const svc = c.current_service_id
                  ? (serviceName.get(c.current_service_id) ?? "—")
                  : "—";
                const stage = c.current_stage_id
                  ? (stageTitle.get(c.current_stage_id) ?? "—")
                  : "—";
                const overdue = overdueByClient.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80">
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/clients/${c.id}`}
                        className="font-medium text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-brand-black">{svc}</td>
                    <td className="px-4 py-3 text-brand-black">{stage}</td>
                    <td className="px-4 py-3">
                      {overdue ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700">
                          Overdue reply
                        </span>
                      ) : (
                        <span className="text-brand-black/45">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!session.isPreviewing ? (
                        <EsNaturalSupportButton clientId={c.id} clientLabel={name} />
                      ) : (
                        <span className="text-brand-black/45">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </ResponsiveTableShell>
    </main>
  );
}
