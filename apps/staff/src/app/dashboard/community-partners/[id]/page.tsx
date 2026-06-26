import { clientDisplayName } from "@wayfinder/branding";
import { createServerClient } from "@wayfinder/supabase";
import { isAdminTierRole } from "@wayfinder/supabase/roles";
import { EmployerApplicationsPanel } from "@/components/employer-applications-panel";
import { EmployerClientMatchPanel } from "@/components/employer-client-match-panel";
import type { EmployerRow } from "@/components/community-partners-workspace";
import { EmployerDetailForm } from "@/components/employer-detail-form";
import {
  EmployerStatusLogPanel,
  type EmployerStatusLogEntry,
} from "@/components/employer-status-log-panel";
import { canEditCommunityPartners, isCommunityPartnersRole } from "@/lib/community-partners-auth";
import { fetchOfficesForPicker } from "@/lib/office-visibility";
import { COMMUNITY_PARTNERS_NETWORK_NAME } from "@/lib/employer-constants";
import {
  employerMatchEligibility,
  findClientMatchesForEmployer,
  type ClientMatchCandidate,
} from "@/lib/employer-matching";
import { supabaseEmbedOne } from "@/lib/supabase-embed";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

const EMPLOYER_SELECT =
  "id, name, status, industry, contact_name, contact_email, contact_phone, address_line1, address_line2, city, state, zip, latitude, longitude, website, notes, office_id, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other, submission_source, offices(name)";

const CLIENT_MATCH_SELECT =
  "id, user_id, contact_email, home_latitude, home_longitude, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other";

export default async function CommunityPartnerDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  if (!isCommunityPartnersRole(session.effectiveRole)) {
    notFound();
  }

  const supabase = await createServerClient();
  const isAdminTier = isAdminTierRole(session.effectiveRole);
  const effectiveUserId = session.effectiveUserId;
  const canEdit = canEditCommunityPartners(session.effectiveRole);
  const readOnly = session.isPreviewing || !canEdit;
  const canDelete = isAdminTier && !session.isPreviewing;

  const { data: employer, error } = await supabase
    .from("employers")
    .select(EMPLOYER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error?.message.includes("employers") || !employer) {
    notFound();
  }

  let assignedClientIds: string[] = [];
  if (!isAdminTier) {
    const { data: assignments } = await supabase
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", effectiveUserId);
    assignedClientIds = (assignments ?? []).map((a) => a.client_id as string).filter(Boolean);
  }

  const clientsQuery = isAdminTier
    ? supabase.from("clients").select(CLIENT_MATCH_SELECT)
    : assignedClientIds.length
      ? supabase.from("clients").select(CLIENT_MATCH_SELECT).in("id", assignedClientIds)
      : null;

  const applicationsQuery = isAdminTier
    ? supabase
        .from("applications")
        .select("id, status, company_name, created_at, client_id")
        .eq("employer_id", id)
        .order("created_at", { ascending: false })
    : assignedClientIds.length
      ? supabase
          .from("applications")
          .select("id, status, company_name, created_at, client_id")
          .eq("employer_id", id)
          .in("client_id", assignedClientIds)
          .order("created_at", { ascending: false })
      : null;

  const [{ data: officesRaw }, clientsResult, applicationsResult, { data: statusLogsRaw }] =
    await Promise.all([
      fetchOfficesForPicker(supabase, {
        alwaysIncludeIds: [(employer as { office_id?: string | null }).office_id],
      }).then((rows) => ({ data: rows })),
      clientsQuery ?? Promise.resolve({ data: [] as Record<string, unknown>[] }),
      applicationsQuery ?? Promise.resolve({ data: [] as Record<string, unknown>[] }),
      supabase
        .from("employer_status_logs")
        .select("id, old_status, new_status, created_at, changed_by")
        .eq("employer_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const clientsRaw = clientsResult.data ?? [];
  const applicationsRaw = applicationsResult.data ?? [];

  const userIds = [...new Set(clientsRaw.map((c) => c.user_id as string).filter(Boolean))];
  const changerIds = [
    ...new Set((statusLogsRaw ?? []).map((l) => l.changed_by as string).filter(Boolean)),
  ];
  const profileIds = [...new Set([...userIds, ...changerIds])];

  const { data: profiles } =
    profileIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", profileIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const nameByUser = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const clientCandidates: ClientMatchCandidate[] = clientsRaw.map((c) => ({
    id: c.id as string,
    label: clientDisplayName({
      full_name: nameByUser.get(c.user_id as string) ?? null,
      contact_email: c.contact_email as string | null,
      id: c.id as string,
    }),
    home_latitude: c.home_latitude as number | null,
    home_longitude: c.home_longitude as number | null,
    employment_goal_primary: c.employment_goal_primary as string | null,
    employment_goal_primary_other: c.employment_goal_primary_other as string | null,
    employment_goal_secondary: c.employment_goal_secondary as string | null,
    employment_goal_secondary_other: c.employment_goal_secondary_other as string | null,
  }));

  const clientLabelById = new Map(clientCandidates.map((c) => [c.id, c.label]));

  const applications = applicationsRaw.map((a) => ({
    id: a.id as string,
    status: a.status as string | null,
    company_name: a.company_name as string | null,
    created_at: a.created_at as string,
    client_id: a.client_id as string,
    client_label: clientLabelById.get(a.client_id as string) ?? "Client",
  }));

  const statusLogs: EmployerStatusLogEntry[] = (statusLogsRaw ?? []).map((log) => ({
    id: log.id as string,
    old_status: log.old_status as string | null,
    new_status: log.new_status as string,
    created_at: log.created_at as string,
    changed_by_name: log.changed_by
      ? (nameByUser.get(log.changed_by as string) ?? null)
      : null,
  }));

  const employerForMatch = {
    id: employer.id as string,
    name: employer.name as string,
    status: employer.status as string,
    city: employer.city as string | null,
    state: employer.state as string | null,
    latitude: employer.latitude as number | null,
    longitude: employer.longitude as number | null,
    position_need_primary: employer.position_need_primary as string | null,
    position_need_primary_other: employer.position_need_primary_other as string | null,
    position_need_secondary: employer.position_need_secondary as string | null,
    position_need_secondary_other: employer.position_need_secondary_other as string | null,
  };

  const clientMatches = findClientMatchesForEmployer(employerForMatch, clientCandidates);
  const eligibility = employerMatchEligibility(employerForMatch);

  return (
    <main className="px-6 py-10">
      <Link
        href="/dashboard/community-partners"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to {COMMUNITY_PARTNERS_NETWORK_NAME}
      </Link>

      <header className="mt-6 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl font-semibold text-brand-black">{employer.name}</h1>
        {employer.industry ? (
          <p className="mt-1 text-sm text-brand-black/65">{employer.industry}</p>
        ) : null}
        {employer.submission_source === "public" ? (
          <p className="mt-2 text-sm text-amber-800">Submitted via public join form</p>
        ) : null}
      </header>

      {readOnly ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {session.isPreviewing
            ? "Read-only preview — exit preview to edit this employer."
            : "View-only access — contact an Employment Specialist or administrator to edit this partner."}
        </p>
      ) : null}

      <div className="mt-8 max-w-2xl space-y-6">
        <EmployerClientMatchPanel
          matches={clientMatches}
          eligibility={eligibility}
          scopeLabel={
            isAdminTier ? "all clients in the system" : "your assigned clients"
          }
        />
        <EmployerApplicationsPanel
          applications={applications}
          scopeLabel={isAdminTier ? "all linked applications" : "applications from your caseload"}
        />
        <EmployerStatusLogPanel logs={statusLogs} />
        <EmployerDetailForm
          employer={
            {
              ...employer,
              offices: supabaseEmbedOne(
                (employer as { offices?: { name: string } | { name: string }[] | null }).offices
              ),
            } as EmployerRow
          }
          offices={(officesRaw ?? []) as { id: string; name: string }[]}
          readOnly={readOnly}
          canDelete={canDelete}
        />
      </div>
    </main>
  );
}
