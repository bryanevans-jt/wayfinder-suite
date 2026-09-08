import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadIntakeAppointmentsAsMeetings } from "@wayfinder/supabase/hospitality-intake-activity";
import { buildClientActivityFeed, ClientActivityTimeline } from "@wayfinder/branding";
import type { SupabaseClient } from "@supabase/supabase-js";

type Props = {
  dataClient: SupabaseClient;
  activityFkIds: string[];
  linkId: string;
  emptyMessage?: string;
};

/** Flat activity timeline used when service episodes are unavailable or not yet backfilled. */
export async function CounselorLegacyActivityTimeline({
  dataClient,
  activityFkIds,
  linkId,
  emptyMessage = "No contact logs, applications, milestone events, or upcoming meetings yet for this client.",
}: Props) {
  const now = new Date().toISOString();
  const intakeAdmin = createServiceRoleClient();

  const [
    { data: logs },
    { data: stageEvents },
    { data: applications },
    { data: meetings },
    intakeMeetings,
  ] = await Promise.all([
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
    loadIntakeAppointmentsAsMeetings(intakeAdmin, [linkId, ...activityFkIds]),
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
    meetings: [
      ...(meetings ?? []).map((m) => ({
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
      ...intakeMeetings,
    ],
  });

  return <ClientActivityTimeline feed={feed} emptyMessage={emptyMessage} />;
}
