import { createServerClient, isEsReplyOverdue, isEsRole, staffHomePath } from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import {
  clientDisplayName,
  isTerminalApplicationStatus,
  serviceDisplayName,
} from "@wayfinder/branding";
import { sortClientsByTriage, STALE_APPLICATION_DAYS } from "@wayfinder/supabase/caseload-triage";
import { USER_FACING_SYSTEM_ERROR } from "@wayfinder/supabase/error-log";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ViewArchivedToggle } from "@/components/view-archived-toggle";
import { isArchivedClient, isPendingArchive } from "@wayfinder/supabase/client-archive";
import { CaseloadTriageLegend } from "@/components/caseload-triage-legend";
import {
  EsApplicationPipelineBoard,
  type PipelineApplication,
} from "@/components/es-application-pipeline-board";
import { EsClientsTable } from "@/components/es-clients-table";
import { EsClientsTodayStrip } from "@/components/es-clients-today-strip";
import { loadCaseloadTriageFlags } from "@/lib/caseload-operations";
import { fetchEsCaseloadClients, getEsCaseloadAdmin } from "@/lib/es-caseload-data";
import { fetchOfficesForPicker } from "@/lib/office-visibility";
import {
  filterSunsetCounselors,
  filterSunsetServices,
  loadSunsetKeepIds,
} from "@/lib/sunset-tn";
import { AddClientLauncher } from "./add-client-launcher";

type PageProps = {
  searchParams: Promise<{ archived?: string }>;
};

export default async function EsClientsPage({ searchParams }: PageProps) {
  const { archived } = await searchParams;
  const includeArchived = archived === "1";

  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const effectiveRole = session.effectiveRole;
  const effectiveUserId = session.effectiveUserId;

  if (!isEsRole(effectiveRole)) {
    redirect(staffHomePath(effectiveRole));
  }

  const admin = getEsCaseloadAdmin();
  const supabase = await createServerClient();
  const lookupClient = admin ?? supabase;

  const caseload = await fetchEsCaseloadClients(effectiveUserId, { includeArchived });
  const pinServiceIds = (caseload.clients ?? []).map((c) => c.current_service_id);

  const [servicesQuery, offices, { data: counselorsRaw }, sunset] = await Promise.all([
    lookupClient.from("services").select("id, name, state").order("name", { ascending: true }),
    fetchOfficesForPicker(lookupClient),
    lookupClient
      .from("counselors")
      .select("id, full_name, office_id, offices(name)")
      .order("full_name", { ascending: true }),
    loadSunsetKeepIds(lookupClient),
  ]);

  let servicesRaw: Array<{ id: string; name: string; state?: string | null }> =
    (servicesQuery.data ?? []) as Array<{ id: string; name: string; state?: string | null }>;
  if (servicesQuery.error?.message.includes("state")) {
    const fallback = await lookupClient.from("services").select("id, name").order("name", {
      ascending: true,
    });
    servicesRaw = (fallback.data ?? []) as Array<{
      id: string;
      name: string;
      state?: string | null;
    }>;
  }

  if (caseload.error) {
    return (
      <main className="px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
        <p className="mt-2 text-sm text-red-700">{USER_FACING_SYSTEM_ERROR}</p>
      </main>
    );
  }

  const clients = caseload.clients;

  const clientIds = clients.map((c) => c.id);

  const triageFlagsByClient =
    admin && clientIds.length > 0
      ? await loadCaseloadTriageFlags(admin, effectiveUserId, clientIds)
      : new Map();

  const profileIds = [
    ...new Set(clients.map((c) => c.user_id ?? c.profile_id).filter(Boolean)),
  ] as string[];
  const { data: profiles } =
    profileIds.length > 0
      ? await lookupClient.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const serviceIds = [...new Set(clients.map((c) => c.current_service_id).filter(Boolean))] as string[];
  let serviceRowsResolved: Array<{ id: string; name: string; state?: string | null }> = [];
  if (serviceIds.length > 0) {
    const serviceQuery = await lookupClient
      .from("services")
      .select("id, name, state")
      .in("id", serviceIds);
    if (serviceQuery.error?.message.includes("state")) {
      const fallback = await lookupClient.from("services").select("id, name").in("id", serviceIds);
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
      ? await lookupClient.from("service_milestones").select("id, title").in("id", stageIds)
      : { data: [] as { id: string; title: string }[] };

  const stageTitle = new Map((stageRows ?? []).map((m) => [m.id, m.title]));

  const messageLookup = admin ?? supabase;
  const { data: messageThreads } = await messageLookup
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
    filterSunsetCounselors(
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
          office_ids: c.office_id ? [c.office_id as string] : [],
          offices: officesEmbed,
        };
      }),
      sunset
    ) ?? [];

  servicesRaw = filterSunsetServices(servicesRaw, sunset.keepServiceIds, pinServiceIds);

  const clientRows = clients.map((c) => {
    const profileId = c.user_id ?? c.profile_id;
    const name = clientDisplayName({
      full_name: (profileId ? profileName.get(profileId) : null) ?? c.full_name ?? null,
      contact_email: c.contact_email,
      id: c.id,
    });
    return { ...c, displayName: name };
  });

  const sortedClients = sortClientsByTriage(
    clientRows.map((c) => ({ id: c.id, name: c.displayName })),
    triageFlagsByClient
  ).map((row) => clientRows.find((c) => c.id === row.id)!);

  let pipelineApplications: PipelineApplication[] = [];
  let meetingsPending = 0;
  let meetingsSoon = 0;
  if (admin && clientIds.length > 0) {
    const [{ data: appRows }, { data: meetingRows }] = await Promise.all([
      admin
        .from("applications")
        .select("id, client_id, company_name, status, updated_at, created_at")
        .in("client_id", clientIds)
        .order("updated_at", { ascending: false }),
      admin
        .from("client_meeting_requests")
        .select("id, client_id, status, starts_at")
        .eq("es_user_id", effectiveUserId)
        .in("client_id", clientIds)
        .in("status", ["pending", "accepted"]),
    ]);
    const nameByClient = new Map(clientRows.map((c) => [c.id, c.displayName]));
    pipelineApplications = (appRows ?? []).map((a) => ({
      id: a.id as string,
      clientId: a.client_id as string,
      clientName: nameByClient.get(a.client_id as string) ?? "Client",
      companyName: (a.company_name as string) || "—",
      status: (a.status as string) || "Applied",
      updatedAt: (a.updated_at ?? a.created_at) as string,
    }));

    const now = Date.now();
    const weekMs = 7 * 24 * 60 * 60 * 1000;
    for (const m of meetingRows ?? []) {
      if ((m.status as string) === "pending") {
        meetingsPending += 1;
        continue;
      }
      if ((m.status as string) === "accepted" && m.starts_at) {
        const start = Date.parse(m.starts_at as string);
        if (!Number.isNaN(start) && start >= now && start <= now + weekMs) {
          meetingsSoon += 1;
        }
      }
    }
  }

  const staleCutoff = Date.now() - STALE_APPLICATION_DAYS * 24 * 60 * 60 * 1000;
  const staleApplications = pipelineApplications.filter((a) => {
    if (isTerminalApplicationStatus(a.status)) return false;
    const updated = Date.parse(a.updatedAt);
    return !Number.isNaN(updated) && updated <= staleCutoff;
  }).length;

  let noContact = 0;
  for (const flags of triageFlagsByClient.values()) {
    if (flags.includes("no_contact")) noContact += 1;
  }

  const needsReply = [...overdueByClient.keys()].filter((id) => clientIds.includes(id)).length;

  return (
    <main className="px-4 py-8 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-brand-black">Clients</h1>
          <p className="mt-1 max-w-2xl text-sm text-brand-black/75">
            Everyone listed here is assigned to you. Clients who need follow-up appear first in the
            table. Use the application pipeline above to update statuses — click a card, then pick
            the new stage. Open a row to update their current stage.
            {includeArchived ? (
              <> Showing closed and archived clients (Closed or Dismissed).</>
            ) : (
              <>
                {" "}
                Closed clients leave this list immediately and archive after 24 hours unless you
                turn on View archived.
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Suspense fallback={null}>
            <ViewArchivedToggle />
          </Suspense>
          {!session.isPreviewing ? (
            <AddClientLauncher
              serviceCatalog={servicesRaw}
              offices={offices.map((office) => ({
                id: office.id,
                name: office.name,
                state: office.state ?? null,
              }))}
              counselors={counselors}
            />
          ) : null}
        </div>
      </div>

      {!includeArchived ? (
        <EsClientsTodayStrip
          needsReply={needsReply}
          meetingsPending={meetingsPending}
          meetingsSoon={meetingsSoon}
          staleApplications={staleApplications}
          noContact={noContact}
          activePipeline={pipelineApplications.filter((a) => !isTerminalApplicationStatus(a.status)).length}
        />
      ) : null}

      <div id="pipeline">
        <EsApplicationPipelineBoard
          applications={pipelineApplications}
          readOnly={session.isPreviewing}
        />
      </div>

      <CaseloadTriageLegend />

      <div id="caseload">
        <EsClientsTable
          includeArchived={includeArchived}
          canManageSupport={!session.isPreviewing}
          clients={sortedClients.map((c) => ({
            id: c.id,
            displayName: c.displayName,
            serviceLabel: c.current_service_id
              ? (serviceName.get(c.current_service_id) ?? "—")
              : "—",
            stageLabel: c.current_stage_id
              ? (stageTitle.get(c.current_stage_id) ?? "—")
              : "—",
            overdue: Boolean(overdueByClient.get(c.id)),
            archived: isArchivedClient(c.archived_at),
            pendingArchive: isPendingArchive(c.archived_at),
            triageFlags: triageFlagsByClient.get(c.id) ?? [],
          }))}
        />
      </div>
    </main>
  );
}
