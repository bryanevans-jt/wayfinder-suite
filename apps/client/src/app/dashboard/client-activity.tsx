import { buildClientActivityFeed, ClientActivityTimeline } from "@wayfinder/branding";
import {
  buildClientActivityFkIds,
  createServerClient,
  resolveClientPortalDataAccess,
} from "@wayfinder/supabase";
import { getAppSession } from "@wayfinder/supabase/preview-server";

type Props = {
  selectedClientId?: string;
};

export async function ClientActivity({ selectedClientId }: Props) {
  const session = await getAppSession();
  if (!session) {
    return null;
  }

  const supabase = await createServerClient();
  const access = await resolveClientPortalDataAccess(
    supabase,
    session.effectiveUserId,
    session.effectiveRole,
    selectedClientId
  );

  if (!access) {
    return null;
  }

  const { ctx, admin } = access;
  const clientId = ctx.clientId;

  const { data: clientForFk } = await admin
    .from("clients")
    .select("id, user_id, profile_id")
    .eq("id", clientId)
    .maybeSingle();

  const activityFkIds = clientForFk ? buildClientActivityFkIds(clientForFk) : [clientId];

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
        .select("id, status, status_other_reason, company_name, notes, created_at")
        .in("client_id", activityFkIds)
        .order("created_at", { ascending: true }),
      admin
        .from("client_meeting_requests")
        .select("id, status, starts_at, timezone, location, created_at, service_id, es_user_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true }),
    ]);

  const serviceIds = [...new Set((meetings ?? []).map((m) => m.service_id).filter(Boolean))] as string[];
  const esIds = [...new Set((meetings ?? []).map((m) => m.es_user_id).filter(Boolean))] as string[];

  const [{ data: services }, { data: esProfiles }] = await Promise.all([
    serviceIds.length
      ? admin.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    esIds.length
      ? admin.from("profiles").select("id, full_name").in("id", esIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  const serviceNameById = new Map((services ?? []).map((s) => [s.id, s.name]));
  const esNameById = new Map((esProfiles ?? []).map((p) => [p.id, p.full_name]));

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
      service_name: m.service_id ? (serviceNameById.get(m.service_id as string) ?? null) : null,
      es_name: m.es_user_id ? (esNameById.get(m.es_user_id as string) ?? null) : null,
    })),
  });

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-brand-green">Your activity</h2>
      <p className="mt-1 text-sm text-brand-black/70">
        Updates from your Employment Specialist team, including job applications.
      </p>
      <ClientActivityTimeline
        feed={feed}
        emptyMessage="No activity logged yet. Your team will post updates here as you progress."
      />
    </section>
  );
}
