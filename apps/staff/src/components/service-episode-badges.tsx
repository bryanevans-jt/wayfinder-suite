"use client";

import type { ServiceEpisodeRow } from "@wayfinder/supabase/service-episodes";
import { episodeBadgeLabel } from "@wayfinder/supabase/service-episodes";

type Props = {
  episodes: ServiceEpisodeRow[];
};

export function ServiceEpisodeBadges({ episodes }: Props) {
  const visible = episodes.filter((e) => e.status !== "active");

  if (visible.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2" aria-label="Prior service completions">
      {visible.map((ep) => {
        const svc = (ep.service_name ?? "Service").replace(/\s*\(GA\)\s*$/i, "").trim();
        const label = `${svc} ${episodeBadgeLabel(ep.status)}`;
        const target = `#episode-${ep.id}`;
        return (
          <a
            key={ep.id}
            href={target}
            className="rounded-full border border-brand-green/30 bg-brand-green/5 px-3 py-1 text-xs font-semibold text-brand-green hover:bg-brand-green/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            {label}
          </a>
        );
      })}
    </div>
  );
}
