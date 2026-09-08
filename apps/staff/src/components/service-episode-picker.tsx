"use client";

import type { ServiceEpisodeRow } from "@wayfinder/supabase/service-episodes";
import { formatEpisodeHeading } from "@wayfinder/supabase/service-episodes";

type Props = {
  episodes: ServiceEpisodeRow[];
  value: string;
  onChange: (episodeId: string) => void;
  required?: boolean;
};

export function ServiceEpisodePicker({ episodes, value, onChange, required = false }: Props) {
  if (episodes.length <= 1) {
    if (episodes.length === 1 && !value) {
      onChange(episodes[0]!.id);
    }
    return null;
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-brand-black">
        Record activity under{required ? " (required)" : ""}
      </legend>
      <div className="space-y-2">
        {episodes.map((ep) => (
          <label
            key={ep.id}
            className="flex cursor-pointer items-start gap-2 rounded-lg border border-neutral-200 px-3 py-2 text-sm hover:bg-neutral-50"
          >
            <input
              type="radio"
              name="serviceEpisodeId"
              value={ep.id}
              checked={value === ep.id}
              onChange={() => onChange(ep.id)}
              className="mt-1 text-brand-green focus:ring-brand-green"
            />
            <span>{formatEpisodeHeading(ep)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
