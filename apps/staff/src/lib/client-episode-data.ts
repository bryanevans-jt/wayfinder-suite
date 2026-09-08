import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  loadActiveEpisodesForClient,
  loadEpisodesForParticipant,
  clientPresentRatioLast30Days,
  type ServiceEpisodeRow,
} from "@wayfinder/supabase/service-episodes";

export async function loadClientEpisodeContext(clientId: string): Promise<{
  activeEpisodes: ServiceEpisodeRow[];
  allEpisodes: ServiceEpisodeRow[];
  currentEpisode: ServiceEpisodeRow | null;
  clientPresentStats: Awaited<ReturnType<typeof clientPresentRatioLast30Days>>;
}> {
  const admin = createServiceRoleClient();

  const activeEpisodes = await loadActiveEpisodesForClient(admin, clientId);

  const { data: client } = await admin
    .from("clients")
    .select("participant_id")
    .eq("id", clientId)
    .maybeSingle();

  const participantId = client?.participant_id as string | null;
  const allEpisodes = participantId
    ? await loadEpisodesForParticipant(admin, participantId)
    : activeEpisodes;

  const { data: currentEp } = await admin
    .from("service_episodes")
    .select(
      "id, client_id, participant_id, service_id, authorization_number, status, started_at, ended_at, services(name)"
    )
    .eq("client_id", clientId)
    .maybeSingle();

  let currentEpisode: ServiceEpisodeRow | null = null;
  if (currentEp) {
    const services = currentEp.services as { name?: string } | null;
    currentEpisode = {
      id: currentEp.id as string,
      client_id: currentEp.client_id as string,
      participant_id: (currentEp.participant_id as string | null) ?? null,
      service_id: currentEp.service_id as string,
      authorization_number: currentEp.authorization_number as string,
      status: currentEp.status as ServiceEpisodeRow["status"],
      started_at: currentEp.started_at as string,
      ended_at: (currentEp.ended_at as string | null) ?? null,
      service_name: services?.name ?? null,
    };
  }

  const clientPresentStats = await clientPresentRatioLast30Days(admin, clientId);

  return {
    activeEpisodes,
    allEpisodes,
    currentEpisode,
    clientPresentStats,
  };
}
