import { createServerClient } from "@wayfinder/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffSupportNote } from "@/components/staff-support-note";
import { requireCounselorSession } from "@/lib/app-session";
import {
  buildClientActivityFeed,
  ClientActivityTimeline,
  clientDisplayName,
  isGoldApplicationStatus,
} from "@wayfinder/branding";
import {
  fetchCounselorClientForActivity,
  getCounselorPortalAdmin,
} from "@/lib/counselor-portal-data";

type PageProps = { params: Promise<{ id: string }> };

export default async function CounselorClientActivityPage({ params }: PageProps) {
  const { id: clientId } = await params;

  const { session, counselorRow } = await requireCounselorSession();
  if (!counselorRow) {
    notFound();
  }

  const { client, error: clientLoadError } = await fetchCounselorClientForActivity(
    counselorRow.id,
    clientId,
    session.effectiveUserId
  );

  if (!client) {
    if (clientLoadError) {
      return (
        <main className="px-6 py-10">
          <Link
            href="/dashboard/counselor"
            className="text-sm font-medium text-brand-green hover:underline"
          >
            ← Back to client grid
          </Link>
          <div className="mt-8 max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50/80 p-5">
            <h1 className="text-lg font-semibold text-brand-black">Could not load this client</h1>
            <p className="text-sm text-red-900">{clientLoadError}</p>
            <StaffSupportNote />
          </div>
        </main>
      );
    }
    notFound();
  }

  const admin = getCounselorPortalAdmin();
  const dataClient = admin ?? (await createServerClient());
  const activityFkIds = client.activityFkIds;

  const clientProfileUserId = (client.user_id ?? client.profile_id) as string;

  const { data: clientProfile } = await dataClient
    .from("profiles")
    .select("full_name, first_name, last_name")
    .eq("id", clientProfileUserId)
    .maybeSingle();

  const displayName = clientDisplayName({
    full_name: clientProfile?.full_name ?? null,
    first_name: clientProfile?.first_name ?? null,
    last_name: clientProfile?.last_name ?? null,
    contact_email: client.contact_email,
    id: client.linkId,
  });

  const { data: currentMs } = client.current_stage_id
    ? await dataClient
        .from("service_milestones")
        .select("title")
        .eq("id", client.current_stage_id)
        .maybeSingle()
    : { data: null as { title: string } | null };

  const now = new Date().toISOString();

  const [{ data: logs }, { data: stageEvents }, { data: applications }, { data: meetings }] =
    await Promise.all([
    dataClient
      .from("contact_logs")
      .select("id, created_at, public_outcome, notes")
      .in("client_id", activityFkIds)
      .order("created_at", { ascending: true }),
    dataClient
      .from("client_stage_events")
      .select("id, created_at, milestone_id, service_milestones(title)")
      .in("client_id", activityFkIds)
      .order("created_at", { ascending: true }),
    dataClient
      .from("applications")
      .select("id, status, company_name, notes, created_at")
      .in("client_id", activityFkIds)
      .order("created_at", { ascending: true }),
    dataClient
      .from("client_meeting_requests")
      .select("id, status, starts_at, timezone, location, created_at, service_id, es_user_id")
      .in("client_id", activityFkIds)
      .eq("status", "accepted")
      .gte("starts_at", now)
      .order("starts_at", { ascending: true }),
  ]);

  const meetingServiceIds = [
    ...new Set((meetings ?? []).map((m) => m.service_id).filter(Boolean)),
  ] as string[];
  const meetingEsIds = [
    ...new Set((meetings ?? []).map((m) => m.es_user_id).filter(Boolean)),
  ] as string[];

  const [{ data: meetingServices }, { data: meetingEsProfiles }] = await Promise.all([
    meetingServiceIds.length
      ? dataClient.from("services").select("id, name").in("id", meetingServiceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    meetingEsIds.length
      ? dataClient.from("profiles").select("id, full_name").in("id", meetingEsIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const meetingServiceNameById = new Map((meetingServices ?? []).map((s) => [s.id, s.name]));
  const meetingEsNameById = new Map((meetingEsProfiles ?? []).map((p) => [p.id, p.full_name]));

  const feed = buildClientActivityFeed({
    logs: (logs ?? []) as Parameters<typeof buildClientActivityFeed>[0]["logs"],
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

  const latestApp = [...(applications ?? [])].sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  )[0];
  const gold = isGoldApplicationStatus(latestApp?.status as string | undefined);

  return (
    <main className="px-6 py-10">
      <Link
        href="/dashboard/counselor"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to client grid
      </Link>

      <header className="mt-6 max-w-3xl border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-brand-green">{displayName}</h1>
            <p className="mt-2 text-sm text-brand-black/80">
              <span className="font-medium text-brand-green">Current stage</span> ·{" "}
              {currentMs?.title ?? "—"}
            </p>
          </div>
          {gold ? (
            <span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {String(latestApp?.status)}
            </span>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-3xl py-10">
        <h2 className="text-lg font-semibold text-brand-green">Activity timeline</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Contact notes, job applications, milestone updates, and confirmed upcoming meetings,
          oldest first. This view is read-only.
        </p>
        <ClientActivityTimeline
          feed={feed}
          emptyMessage="No contact logs, applications, milestone events, or upcoming meetings yet for this client."
        />
      </section>

      <footer className="mx-auto max-w-3xl border-t border-neutral-100 pt-6">
        <StaffSupportNote />
      </footer>
    </main>
  );
}
