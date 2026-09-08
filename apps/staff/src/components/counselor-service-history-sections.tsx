import { buildClientActivityFeed, ClientActivityTimeline } from "@wayfinder/branding";
import type { ServiceEpisodeRow } from "@wayfinder/supabase/service-episodes";
import {
  episodeBadgeLabel,
  formatEpisodeHeading,
  loadEpisodeActivitySummary,
} from "@wayfinder/supabase/service-episodes";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type Props = {
  currentClientId: string;
  activeEpisodes: ServiceEpisodeRow[];
  priorEpisodes: ServiceEpisodeRow[];
  showHistory: boolean;
};

async function loadEpisodeFeed(episodeId: string) {
  const admin = createServiceRoleClient();
  const { contactLogs, stageEvents } = await loadEpisodeActivitySummary(admin, episodeId);

  return buildClientActivityFeed({
    logs: contactLogs.map((l) => ({
      id: l.id,
      created_at: l.created_at,
      public_outcome: l.public_outcome,
      notes: l.notes,
    })),
    stageEvents: stageEvents.map((e) => ({
      id: e.id,
      created_at: e.created_at,
      service_milestones: { title: e.title ?? undefined },
    })),
    applications: [],
    meetings: [],
  });
}

function EpisodeSection({
  episode,
  feed,
  defaultOpen,
}: {
  episode: ServiceEpisodeRow;
  feed: Awaited<ReturnType<typeof buildClientActivityFeed>>;
  defaultOpen: boolean;
}) {
  const badge = episode.status === "active" ? "In progress" : episodeBadgeLabel(episode.status);
  const heading = formatEpisodeHeading(episode);

  return (
    <details
      id={`episode-${episode.id}`}
      open={defaultOpen}
      className="rounded-xl border border-neutral-200 bg-white"
    >
      <summary className="cursor-pointer list-none px-4 py-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green [&::-webkit-details-marker]:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-brand-green">{heading}</h3>
          <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-brand-black/75">
            {badge}
          </span>
        </div>
      </summary>
      <div className="border-t border-neutral-100 px-4 py-4">
        <ClientActivityTimeline
          feed={feed}
          emptyMessage="No contact notes or milestone updates for this authorization yet."
        />
      </div>
    </details>
  );
}

export async function CounselorServiceHistorySections({
  activeEpisodes,
  priorEpisodes,
  showHistory,
}: Props) {
  const activeSorted = [...activeEpisodes].sort((a, b) =>
    a.started_at.localeCompare(b.started_at)
  );
  const priorSorted = showHistory
    ? [...priorEpisodes].sort((a, b) => a.started_at.localeCompare(b.started_at))
    : [];

  const episodesToRender = [...activeSorted, ...priorSorted];

  if (episodesToRender.length === 0) {
    return (
      <p className="text-sm text-brand-black/65">
        No service authorizations are linked to this client yet.
      </p>
    );
  }

  const feeds = await Promise.all(
    episodesToRender.map(async (ep) => ({
      episode: ep,
      feed: await loadEpisodeFeed(ep.id),
    }))
  );

  return (
    <div className="space-y-4">
      {feeds.map(({ episode, feed }) => (
        <EpisodeSection
          key={episode.id}
          episode={episode}
          feed={feed}
          defaultOpen={episode.status === "active"}
        />
      ))}
    </div>
  );
}
