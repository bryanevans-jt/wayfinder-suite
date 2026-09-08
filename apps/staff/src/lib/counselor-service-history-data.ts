import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  loadActiveEpisodesForClient,
  loadEpisodesForParticipant,
  type ServiceEpisodeRow,
} from "@wayfinder/supabase/service-episodes";

export async function loadCounselorServiceHistoryContext(
  clientId: string,
  showHistory: boolean
): Promise<{
  activeEpisodes: ServiceEpisodeRow[];
  priorEpisodes: ServiceEpisodeRow[];
}> {
  const admin = createServiceRoleClient();

  const { data: client } = await admin
    .from("clients")
    .select("participant_id")
    .eq("id", clientId)
    .maybeSingle();

  const participantId = client?.participant_id as string | null;

  if (!participantId) {
    const { data: episode } = await admin
      .from("service_episodes")
      .select(
        "id, client_id, participant_id, service_id, authorization_number, status, started_at, ended_at, services(name)"
      )
      .eq("client_id", clientId)
      .maybeSingle();

    if (!episode) {
      return { activeEpisodes: [], priorEpisodes: [] };
    }

    const row: ServiceEpisodeRow = {
      id: episode.id as string,
      client_id: episode.client_id as string,
      participant_id: (episode.participant_id as string | null) ?? null,
      service_id: episode.service_id as string,
      authorization_number: episode.authorization_number as string,
      status: episode.status as ServiceEpisodeRow["status"],
      started_at: episode.started_at as string,
      ended_at: (episode.ended_at as string | null) ?? null,
      service_name: (episode.services as { name?: string } | null)?.name ?? null,
    };

    if (row.status === "active") {
      return { activeEpisodes: [row], priorEpisodes: [] };
    }
    return {
      activeEpisodes: [],
      priorEpisodes: showHistory ? [row] : [],
    };
  }

  const all = await loadEpisodesForParticipant(admin, participantId);
  const active = all
    .filter((e) => e.status === "active")
    .sort((a, b) => a.started_at.localeCompare(b.started_at));
  const prior = showHistory
    ? all.filter((e) => e.status !== "active").sort((a, b) => a.started_at.localeCompare(b.started_at))
    : [];

  return { activeEpisodes: active, priorEpisodes: prior };
}

export async function loadCounselorShowHistoryPreference(
  profileUserId: string
): Promise<boolean> {
  const admin = createServiceRoleClient();
  const { data } = await admin
    .from("profiles")
    .select("counselor_show_prior_service_history")
    .eq("id", profileUserId)
    .maybeSingle();

  if (data?.counselor_show_prior_service_history === false) {
    return false;
  }
  return true;
}
