import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError, isVocationalEpisodesSchemaAvailable } from "./schema-fallback";

export type ServiceEpisodeStatus = "active" | "complete" | "dismissed";

export type ServiceEpisodeRow = {
  id: string;
  client_id: string;
  participant_id: string | null;
  service_id: string;
  authorization_number: string;
  status: ServiceEpisodeStatus;
  started_at: string;
  ended_at: string | null;
  service_name?: string | null;
};

const TERMINAL_STAGE_PATTERN =
  /^(complete|dismissed|closed(\s+successfully)?|services\s+interrupted)$/i;

export function isTerminalMilestoneTitle(title: string | null | undefined): boolean {
  return TERMINAL_STAGE_PATTERN.test((title ?? "").trim());
}

export function episodeStatusFromMilestoneTitle(
  title: string | null | undefined
): ServiceEpisodeStatus | null {
  const t = (title ?? "").trim().toLowerCase();
  if (t === "dismissed") return "dismissed";
  if (t === "complete" || t === "closed" || t === "closed successfully") return "complete";
  if (t === "services interrupted") return "complete";
  return null;
}

export function episodeBadgeLabel(status: ServiceEpisodeStatus): string {
  if (status === "complete") return "Complete";
  if (status === "dismissed") return "Dismissed";
  return "In progress";
}

/** Create or refresh the service episode when a referral is activated. */
export async function ensureServiceEpisodeForActivation(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    serviceId: string;
    authorizationNumber: string;
    participantId?: string | null;
  }
): Promise<string | null> {
  if (!(await isVocationalEpisodesSchemaAvailable(admin))) {
    return null;
  }

  const auth = opts.authorizationNumber.trim() || "PENDING";

  const { data: existing } = await admin
    .from("service_episodes")
    .select("id")
    .eq("client_id", opts.clientId)
    .maybeSingle();

  if (existing?.id) {
    await admin
      .from("service_episodes")
      .update({
        service_id: opts.serviceId,
        authorization_number: auth,
        participant_id: opts.participantId ?? null,
        status: "active",
        started_at: new Date().toISOString(),
        ended_at: null,
      })
      .eq("id", existing.id);
    return existing.id as string;
  }

  const { data: created, error } = await admin
    .from("service_episodes")
    .insert({
      client_id: opts.clientId,
      service_id: opts.serviceId,
      authorization_number: auth,
      participant_id: opts.participantId ?? null,
      status: "active",
    })
    .select("id")
    .maybeSingle();

  if (error || !created?.id) {
    console.error("[service_episodes] create failed:", error?.message);
    return null;
  }
  return created.id as string;
}

export async function loadActiveEpisodesForClient(
  admin: SupabaseClient,
  clientId: string
): Promise<ServiceEpisodeRow[]> {
  if (!(await isVocationalEpisodesSchemaAvailable(admin))) {
    return [];
  }

  const { data: client } = await admin
    .from("clients")
    .select("participant_id")
    .eq("id", clientId)
    .maybeSingle();

  const participantId = client?.participant_id as string | null;
  if (!participantId) {
    return loadEpisodesForClientIds(admin, [clientId], "active");
  }

  const { data: clientRows } = await admin
    .from("clients")
    .select("id")
    .eq("participant_id", participantId);

  const ids = (clientRows ?? []).map((r) => r.id as string);
  return loadEpisodesForClientIds(admin, ids, "active");
}

export async function loadEpisodesForParticipant(
  admin: SupabaseClient,
  participantId: string,
  options: { includeStatuses?: ServiceEpisodeStatus[] } = {}
): Promise<ServiceEpisodeRow[]> {
  if (!(await isVocationalEpisodesSchemaAvailable(admin))) {
    return [];
  }

  let query = admin
    .from("service_episodes")
    .select(
      "id, client_id, participant_id, service_id, authorization_number, status, started_at, ended_at, services(name)"
    )
    .eq("participant_id", participantId)
    .order("started_at", { ascending: true });

  const statuses = options.includeStatuses;
  if (statuses?.length) {
    query = query.in("status", statuses);
  }

  const { data } = await query;
  return (data ?? []).map(mapEpisodeRow);
}

async function loadEpisodesForClientIds(
  admin: SupabaseClient,
  clientIds: string[],
  status?: ServiceEpisodeStatus
): Promise<ServiceEpisodeRow[]> {
  if (clientIds.length === 0) return [];
  let query = admin
    .from("service_episodes")
    .select(
      "id, client_id, participant_id, service_id, authorization_number, status, started_at, ended_at, services(name)"
    )
    .in("client_id", clientIds)
    .order("started_at", { ascending: true });
  if (status) {
    query = query.eq("status", status);
  }
  const { data } = await query;
  return (data ?? []).map(mapEpisodeRow);
}

function mapEpisodeRow(row: Record<string, unknown>): ServiceEpisodeRow {
  const services = row.services as { name?: string } | { name?: string }[] | null;
  const s = Array.isArray(services) ? services[0] : services;
  return {
    id: row.id as string,
    client_id: row.client_id as string,
    participant_id: (row.participant_id as string | null) ?? null,
    service_id: row.service_id as string,
    authorization_number: row.authorization_number as string,
    status: row.status as ServiceEpisodeStatus,
    started_at: row.started_at as string,
    ended_at: (row.ended_at as string | null) ?? null,
    service_name: s?.name ?? null,
  };
}

export type EpisodeActivityResolution = {
  episodeId: string | null;
  /** When >1 active auth, caller must collect ES/TS choice unless episodeId was passed. */
  needsPicker: boolean;
  choices: ServiceEpisodeRow[];
};

/** Pick episode for new activity: explicit id, single active, or require picker when ambiguous. */
export async function resolveEpisodeForActivity(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    episodeId?: string | null;
  }
): Promise<EpisodeActivityResolution> {
  if (!(await isVocationalEpisodesSchemaAvailable(admin))) {
    return { episodeId: null, needsPicker: false, choices: [] };
  }

  const active = await loadActiveEpisodesForClient(admin, opts.clientId);

  if (opts.episodeId) {
    return { episodeId: opts.episodeId, needsPicker: false, choices: active };
  }

  if (active.length === 0) {
    const { data: fallback } = await admin
      .from("service_episodes")
      .select("id")
      .eq("client_id", opts.clientId)
      .maybeSingle();
    return {
      episodeId: (fallback?.id as string) ?? null,
      needsPicker: false,
      choices: [],
    };
  }

  if (active.length === 1) {
    return { episodeId: active[0]!.id, needsPicker: false, choices: active };
  }

  return { episodeId: null, needsPicker: true, choices: active };
}

export async function loadEpisodeActivitySummary(
  admin: SupabaseClient,
  episodeId: string
): Promise<{
  contactLogs: Array<{ id: string; created_at: string; public_outcome: string | null; notes: string | null }>;
  stageEvents: Array<{ id: string; created_at: string; title: string | null }>;
}> {
  if (!(await isVocationalEpisodesSchemaAvailable(admin))) {
    return { contactLogs: [], stageEvents: [] };
  }

  const [{ data: logs, error: logsError }, { data: events, error: eventsError }] = await Promise.all([
    admin
      .from("contact_logs")
      .select("id, created_at, public_outcome, notes")
      .eq("service_episode_id", episodeId)
      .order("created_at", { ascending: true }),
    admin
      .from("client_stage_events")
      .select("id, created_at, service_milestones(title)")
      .eq("service_episode_id", episodeId)
      .order("created_at", { ascending: true }),
  ]);

  if (
    (logsError && isMissingSchemaError(logsError.message)) ||
    (eventsError && isMissingSchemaError(eventsError.message))
  ) {
    return { contactLogs: [], stageEvents: [] };
  }

  return {
    contactLogs: (logs ?? []) as Array<{
      id: string;
      created_at: string;
      public_outcome: string | null;
      notes: string | null;
    }>,
    stageEvents: (events ?? []).map((e) => {
      const ms = e.service_milestones as { title?: string } | { title?: string }[] | null;
      const m = Array.isArray(ms) ? ms[0] : ms;
      return {
        id: e.id as string,
        created_at: e.created_at as string,
        title: m?.title ?? null,
      };
    }),
  };
}

/** GVRA guidance: share of client billable hours that are Active (in-person). */
export async function clientPresentRatioLast30Days(
  admin: SupabaseClient,
  clientId: string
): Promise<{ ratio: number; totalMinutes: number; presentMinutes: number }> {
  const { entryCountsTowardClientBillable, entryIsActiveInPerson } = await import(
    "./client-billable"
  );

  const since = new Date();
  since.setDate(since.getDate() - 30);
  const sinceIso = since.toISOString().slice(0, 10);

  const { data, error } = await admin
    .from("es_time_entries")
    .select(
      "duration_minutes, client_present, delivery_mode, flags, service_activity_types ( code, counts_toward_client_billable )"
    )
    .eq("client_id", clientId)
    .gte("service_date", sinceIso)
    .neq("status", "rejected");

  if (error?.message && isMissingSchemaError(error.message)) {
    const { data: legacyRows } = await admin
      .from("es_time_entries")
      .select("duration_minutes, client_present, delivery_mode")
      .eq("client_id", clientId)
      .gte("service_date", sinceIso)
      .neq("status", "rejected");
    let total = 0;
    let activeInPerson = 0;
    for (const row of legacyRows ?? []) {
      const mins = Number(row.duration_minutes) || 0;
      total += mins;
      if (row.client_present && (row.delivery_mode ?? "").toLowerCase() === "in_person") {
        activeInPerson += mins;
      }
    }
    const ratio = total > 0 ? activeInPerson / total : 1;
    return { ratio, totalMinutes: total, presentMinutes: activeInPerson };
  }

  let total = 0;
  let activeInPerson = 0;
  for (const row of data ?? []) {
    const embed = row.service_activity_types as
      | { code?: string; counts_toward_client_billable?: boolean }
      | { code?: string; counts_toward_client_billable?: boolean }[]
      | null;
    const activity = Array.isArray(embed) ? embed[0] : embed;
    const entry = {
      duration_minutes: Number(row.duration_minutes) || 0,
      client_present: row.client_present as boolean | null,
      delivery_mode: row.delivery_mode as string | null,
      counts_toward_client_billable: activity?.counts_toward_client_billable ?? null,
      flags: (row.flags as Record<string, boolean>) ?? {},
    };
    if (!entryCountsTowardClientBillable(entry)) continue;
    total += entry.duration_minutes;
    if (entryIsActiveInPerson(entry)) {
      activeInPerson += entry.duration_minutes;
    }
  }
  const ratio = total > 0 ? activeInPerson / total : 1;
  return { ratio, totalMinutes: total, presentMinutes: activeInPerson };
}

export function formatEpisodeHeading(ep: ServiceEpisodeRow): string {
  const svc = (ep.service_name ?? "Service").replace(/\s*\(GA\)\s*$/i, "").trim();
  const auth = ep.authorization_number || "—";
  const start = ep.started_at.slice(0, 10);
  const end = ep.ended_at?.slice(0, 10) ?? "present";
  return `${svc} · Auth ${auth} · ${start} – ${end}`;
}
