import type { ClientActivityFeedItem } from "./client-activity-timeline";

type MilestoneEmbed = { title?: string } | { title?: string }[] | null;

export function milestoneTitleFromEmbed(embed: MilestoneEmbed | undefined): string {
  if (!embed) return "Milestone";
  if (Array.isArray(embed)) {
    return embed[0]?.title ?? "Milestone";
  }
  return embed.title ?? "Milestone";
}

export function buildClientActivityFeed(input: {
  logs?: {
    id: string;
    created_at: string;
    public_outcome?: string | null;
    notes?: string | null;
  }[];
  stageEvents?: {
    id: string;
    created_at: string;
    service_milestones?: MilestoneEmbed;
  }[];
  applications?: {
    id: string;
    created_at: string;
    status?: string | null;
    status_other_reason?: string | null;
    company_name?: string | null;
    notes?: string | null;
  }[];
  meetings?: {
    id: string;
    created_at: string;
    status: string;
    starts_at: string;
    location: string;
    timezone: string;
    service_name?: string | null;
    es_name?: string | null;
  }[];
}): ClientActivityFeedItem[] {
  const feed: ClientActivityFeedItem[] = [];

  for (const row of input.logs ?? []) {
    feed.push({
      kind: "contact",
      id: row.id,
      at: row.created_at,
      public_outcome: row.public_outcome ?? null,
      notes: row.notes ?? null,
    });
  }

  for (const row of input.stageEvents ?? []) {
    feed.push({
      kind: "milestone",
      id: row.id,
      at: row.created_at,
      title: milestoneTitleFromEmbed(row.service_milestones),
    });
  }

  for (const row of input.applications ?? []) {
    feed.push({
      kind: "application",
      id: row.id,
      at: row.created_at,
      status: row.status ?? null,
      status_other_reason: row.status_other_reason ?? null,
      company_name: row.company_name ?? null,
      notes: row.notes ?? null,
    });
  }

  for (const row of input.meetings ?? []) {
    feed.push({
      kind: "meeting",
      id: row.id,
      at: row.starts_at,
      status: row.status,
      starts_at: row.starts_at,
      location: row.location,
      timezone: row.timezone,
      service_name: row.service_name ?? null,
      es_name: row.es_name ?? null,
    });
  }

  feed.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return feed;
}
