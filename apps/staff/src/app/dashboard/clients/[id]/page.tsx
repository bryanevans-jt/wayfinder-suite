import { buildClientActivityFeed, ClientActivityTimeline, clientDisplayName, normalizeEmploymentGoal } from "@wayfinder/branding";
import { buildClientActivityFkIds, createServerClient, isEsRole } from "@wayfinder/supabase";
import { formatLocalDate, loadActiveActivityTypes } from "@wayfinder/supabase/es-time-tracking";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAppSession, requireEsClientAccess } from "@/lib/app-session";
import { getEsCaseloadAdmin } from "@/lib/es-caseload-data";
import { findEmployerMatches } from "@/lib/employer-matching";
import { supabaseEmbedName } from "@/lib/supabase-embed";
import { ClientProfileForm, type ClientProfileData } from "@/components/client-profile-form";
import { EmployerMatchPanel } from "@/components/employer-match-panel";
import { ClientApplicationForm } from "./client-application-form";
import { ClientContactLogForm } from "./client-contact-log-form";
import { ClientManualTimeForm } from "./client-manual-time-form";
import { ClientMeetingForm } from "./client-meeting-form";
import { ClientStageForm } from "./client-stage-form";
import { NaturalSupportPanel } from "./natural-support-panel";
import { ClientActivityReportPanel } from "@/components/client-activity-report-panel";

type PageProps = { params: Promise<{ id: string }> };

const CLIENT_SELECT =
  "id, user_id, profile_id, contact_email, current_service_id, current_stage_id, office_id, counselor_id, home_address_line1, home_address_line2, home_city, home_state, home_zip, home_latitude, home_longitude, primary_phone, secondary_phone, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other";

export default async function EsClientDetailPage({ params }: PageProps) {
  const { id: clientId } = await params;

  const session = await requireAppSession();
  if (!isEsRole(session.effectiveRole)) {
    notFound();
  }

  const hasAccess = await requireEsClientAccess(session, clientId);
  if (!hasAccess) {
    notFound();
  }

  const supabase = await createServerClient();
  const readOnly = session.isPreviewing;

  const admin = getEsCaseloadAdmin();
  if (!admin) {
    notFound();
  }

  let activities = await loadActiveActivityTypes(admin).catch(() => []);

  const now = new Date();
  const reportDefaultFrom = formatLocalDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const reportDefaultTo = formatLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select(CLIENT_SELECT)
    .eq("id", clientId)
    .maybeSingle();

  if (clientErr || !client) {
    notFound();
  }

  const profileData: ClientProfileData = {
    home_address_line1: client.home_address_line1 as string | null,
    home_address_line2: client.home_address_line2 as string | null,
    home_city: client.home_city as string | null,
    home_state: client.home_state as string | null,
    home_zip: client.home_zip as string | null,
    home_latitude: client.home_latitude as number | null,
    home_longitude: client.home_longitude as number | null,
    primary_phone: client.primary_phone as string | null,
    secondary_phone: client.secondary_phone as string | null,
    employment_goal_primary: client.employment_goal_primary as string | null,
    employment_goal_primary_other: client.employment_goal_primary_other as string | null,
    employment_goal_secondary: client.employment_goal_secondary as string | null,
    employment_goal_secondary_other: client.employment_goal_secondary_other as string | null,
  };

  const clientProfileId = (client.user_id ?? client.profile_id) as string | null;
  const { data: clientProfile } = clientProfileId
    ? await admin.from("profiles").select("full_name").eq("id", clientProfileId).maybeSingle()
    : { data: null as { full_name: string | null } | null };

  const displayName = clientDisplayName({
    full_name: clientProfile?.full_name ?? null,
    contact_email: client.contact_email,
    id: client.id,
  });

  const { data: esProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", session.effectiveUserId)
    .maybeSingle();
  const esDisplayName = (esProfile?.full_name as string | null) ?? null;

  const [
    { data: service },
    { data: stage },
    { data: office },
    { data: counselor },
    { data: milestones },
    { data: employersRaw },
    { data: employerDirectory },
  ] = await Promise.all([
    client.current_service_id
      ? supabase.from("services").select("name").eq("id", client.current_service_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
    client.current_stage_id
      ? supabase
          .from("service_milestones")
          .select("title")
          .eq("id", client.current_stage_id)
          .maybeSingle()
      : Promise.resolve({ data: null as { title: string } | null }),
    client.office_id
      ? supabase.from("offices").select("name").eq("id", client.office_id).maybeSingle()
      : Promise.resolve({ data: null as { name: string } | null }),
    client.counselor_id
      ? supabase.from("counselors").select("full_name").eq("id", client.counselor_id).maybeSingle()
      : Promise.resolve({ data: null as { full_name: string } | null }),
    client.current_service_id
      ? supabase
          .from("service_milestones")
          .select("id, title, order_index")
          .eq("service_id", client.current_service_id)
          .order("order_index", { ascending: true })
      : Promise.resolve({ data: [] as { id: string; title: string; order_index: number }[] }),
    supabase
      .from("employers")
      .select(
        "id, name, status, city, state, latitude, longitude, position_need_primary, position_need_primary_other, position_need_secondary, position_need_secondary_other"
      )
      .eq("status", "active"),
    supabase.from("employers").select("id, name").eq("status", "active").order("name"),
  ]);

  const milestoneOptions = (milestones ?? []).map((m) => ({
    id: m.id,
    title: m.title,
    order_index: m.order_index,
  }));

  const activityFkIds = buildClientActivityFkIds(client);

  const [{ data: logs }, { data: stageEvents }, { data: applications }, { data: meetings }] =
    await Promise.all([
      admin
        .from("contact_logs")
        .select("id, created_at, public_outcome, notes")
        .in("client_id", activityFkIds)
        .order("created_at", { ascending: true }),
      admin
        .from("client_stage_events")
        .select("id, created_at, milestone_id, service_milestones(title)")
        .in("client_id", activityFkIds)
        .order("created_at", { ascending: true }),
      admin
        .from("applications")
        .select(
          "id, status, status_other_reason, company_name, notes, created_at, employer_id, employers(name)"
        )
        .in("client_id", activityFkIds)
        .order("created_at", { ascending: true }),
      admin
        .from("client_meeting_requests")
        .select("id, status, starts_at, timezone, location, created_at, service_id, es_user_id")
        .eq("client_id", client.id)
        .order("created_at", { ascending: true }),
    ]);

  const meetingServiceIds = [
    ...new Set((meetings ?? []).map((m) => m.service_id).filter(Boolean)),
  ] as string[];
  const meetingEsIds = [...new Set((meetings ?? []).map((m) => m.es_user_id).filter(Boolean))] as string[];

  const [{ data: meetingServices }, { data: meetingEsProfiles }] = await Promise.all([
    meetingServiceIds.length
      ? admin.from("services").select("id, name").in("id", meetingServiceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    meetingEsIds.length
      ? admin.from("profiles").select("id, full_name").in("id", meetingEsIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const meetingServiceNameById = new Map((meetingServices ?? []).map((s) => [s.id, s.name]));
  const meetingEsNameById = new Map((meetingEsProfiles ?? []).map((p) => [p.id, p.full_name]));

  const normalizedLogs = (logs ?? []).map((row) => ({
    id: row.id as string,
    created_at: row.created_at as string,
    public_outcome: row.public_outcome as string | null,
    notes: row.notes as string | null,
  }));

  const feed = buildClientActivityFeed({
    logs: normalizedLogs as Parameters<typeof buildClientActivityFeed>[0]["logs"],
    stageEvents: (stageEvents ?? []) as Parameters<
      typeof buildClientActivityFeed
    >[0]["stageEvents"],
    applications: (applications ?? []) as Parameters<
      typeof buildClientActivityFeed
    >[0]["applications"],
    meetings: (meetings ?? []).map((m) => ({
      id: m.id as string,
      created_at: m.created_at as string,
      status: m.status as string,
      starts_at: m.starts_at as string,
      location: m.location as string,
      timezone: m.timezone as string,
      service_name: m.service_id
        ? (meetingServiceNameById.get(m.service_id as string) ?? null)
        : null,
      es_name: m.es_user_id ? (meetingEsNameById.get(m.es_user_id as string) ?? null) : null,
    })),
  });

  const matches = findEmployerMatches(profileData, employersRaw ?? []);
  const missingGoals =
    !normalizeEmploymentGoal(
      profileData.employment_goal_primary,
      profileData.employment_goal_primary_other
    ) &&
    !normalizeEmploymentGoal(
      profileData.employment_goal_secondary,
      profileData.employment_goal_secondary_other
    );
  const missingGeocode =
    profileData.home_latitude == null || profileData.home_longitude == null;

  const employerOptions = (employerDirectory ?? []).map((e) => ({
    id: e.id as string,
    name: e.name as string,
  }));

  return (
    <main className="px-6 py-10">
      <Link
        href="/dashboard/clients"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to clients
      </Link>

      <header className="mt-6 border-b border-neutral-200 pb-6">
        <h1 className="text-3xl font-semibold text-brand-black">{displayName}</h1>
        <dl className="mt-4 grid max-w-2xl gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-brand-black/55">Email</dt>
            <dd className="text-brand-black">{client.contact_email ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Primary phone</dt>
            <dd className="text-brand-black">{profileData.primary_phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Current service</dt>
            <dd className="text-brand-black">{service?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Current stage</dt>
            <dd className="text-brand-black">{stage?.title ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Office</dt>
            <dd className="text-brand-black">{office?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="font-medium text-brand-black/55">Counselor</dt>
            <dd className="text-brand-black">{counselor?.full_name ?? "—"}</dd>
          </div>
        </dl>
      </header>

      {readOnly ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Read-only preview — exit preview to update this client.
        </p>
      ) : null}

      {!readOnly && activities.length === 0 ? (
        <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Time tracking is not available yet — run the{" "}
          <code className="text-xs">20260612190000_es_time_tracking.sql</code> migration in Supabase,
          then refresh this page.
        </p>
      ) : null}

      <section className="mt-8 max-w-2xl space-y-6">
        <ClientProfileForm clientId={client.id} initial={profileData} readOnly={readOnly} />

        <EmployerMatchPanel
          matches={matches}
          missingGoals={missingGoals}
          missingGeocode={missingGeocode}
        />

        {!readOnly && client.current_service_id && milestoneOptions.length > 0 ? (
          <ClientStageForm
            clientId={client.id}
            milestones={milestoneOptions}
            currentStageId={client.current_stage_id}
            activities={activities}
          />
        ) : !readOnly ? (
          <p className="text-sm text-brand-black/75">
            Assign a service with milestones to this client before you can change their stage.
          </p>
        ) : null}

        {!readOnly ? <ClientContactLogForm clientId={client.id} activities={activities} /> : null}
        {!readOnly ? (
          <ClientApplicationForm
            clientId={client.id}
            employers={employerOptions}
            existing={(applications ?? []).map((a) => ({
              id: a.id as string,
              company_name: a.company_name as string | null,
              employer_id: (a as { employer_id?: string | null }).employer_id ?? null,
              employer_name: supabaseEmbedName(
                (a as { employers?: { name: string } | { name: string }[] | null }).employers
              ),
              status: a.status as string | null,
              status_other_reason: (a as { status_other_reason?: string }).status_other_reason ?? null,
              notes: a.notes as string | null,
            }))}
          />
        ) : null}
        {!readOnly ? (
          <ClientMeetingForm
            clientId={client.id}
            serviceId={client.current_service_id}
            serviceName={service?.name ?? null}
          />
        ) : null}
        {!readOnly ? (
          <ClientManualTimeForm clientId={client.id} activities={activities} readOnly={readOnly} />
        ) : null}
        {!readOnly ? (
          <ClientActivityReportPanel
            clientId={client.id}
            clientName={displayName}
            esName={esDisplayName}
            defaultFrom={reportDefaultFrom}
            defaultTo={reportDefaultTo}
          />
        ) : null}
        {!readOnly ? <NaturalSupportPanel clientId={client.id} /> : null}
      </section>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-lg font-semibold text-brand-green">Activity timeline</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Contact logs, applications, and milestone updates — shared with the counselor portal.
        </p>
        <ClientActivityTimeline feed={feed} />
      </section>
    </main>
  );
}
