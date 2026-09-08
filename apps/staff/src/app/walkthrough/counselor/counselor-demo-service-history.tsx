"use client";

import { ClientActivityTimeline } from "@wayfinder/branding";
import type { ClientActivityFeedItem } from "@wayfinder/branding";
import { useMemo, useState } from "react";
import type { DemoServiceEpisode } from "../lib/counselor-mock-data";
import {
  episodeBadgeLabel,
  formatEpisodeHeading,
  type ServiceEpisodeRow,
} from "@wayfinder/supabase/service-episodes";

function toEpisodeRow(ep: DemoServiceEpisode): ServiceEpisodeRow {
  return {
    id: ep.id,
    client_id: ep.clientId,
    participant_id: ep.participantId,
    service_id: ep.id,
    authorization_number: ep.authorizationNumber,
    status: ep.status,
    started_at: ep.startedAt,
    ended_at: ep.endedAt,
    service_name: ep.serviceName,
  };
}

function DemoEpisodeSection({
  episode,
  feed,
  defaultOpen,
}: {
  episode: DemoServiceEpisode;
  feed: ClientActivityFeedItem[];
  defaultOpen: boolean;
}) {
  const row = toEpisodeRow(episode);
  const badge = episode.status === "active" ? "In progress" : episodeBadgeLabel(episode.status);
  const heading = formatEpisodeHeading(row);

  return (
    <details
      id={`demo-episode-${episode.id}`}
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

type Props = {
  episodes: DemoServiceEpisode[];
  episodeFeeds: Record<string, ClientActivityFeedItem[]>;
  initialShowHistory?: boolean;
};

export function CounselorDemoServiceHistory({
  episodes,
  episodeFeeds,
  initialShowHistory = true,
}: Props) {
  const [showHistory, setShowHistory] = useState(initialShowHistory);

  const { active, prior } = useMemo(() => {
    const activeEpisodes = episodes
      .filter((e) => e.status === "active")
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
    const priorEpisodes = showHistory
      ? episodes
          .filter((e) => e.status !== "active")
          .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      : [];
    return { active: activeEpisodes, prior: priorEpisodes };
  }, [episodes, showHistory]);

  const toRender = [...active, ...prior];

  return (
    <>
      <label className="mb-6 flex cursor-pointer items-start gap-2 text-sm text-brand-black/85">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand-green focus:ring-brand-green"
          checked={showHistory}
          onChange={(e) => setShowHistory(e.target.checked)}
          aria-describedby="demo-counselor-history-pref-hint"
        />
        <span>
          <span className="font-medium text-brand-black">Show prior service history</span>
          <span id="demo-counselor-history-pref-hint" className="mt-0.5 block text-brand-black/65">
            When unchecked, only the current authorization&apos;s activity is shown. In the live
            portal, your choice is remembered for future sessions.
          </span>
        </span>
      </label>

      {toRender.length === 0 ? (
        <p className="text-sm text-brand-black/65">
          No service authorizations are linked to this client yet.
        </p>
      ) : (
        <div className="space-y-4">
          {toRender.map((episode) => (
            <DemoEpisodeSection
              key={episode.id}
              episode={episode}
              feed={episodeFeeds[episode.id] ?? []}
              defaultOpen={episode.status === "active"}
            />
          ))}
        </div>
      )}
    </>
  );
}
