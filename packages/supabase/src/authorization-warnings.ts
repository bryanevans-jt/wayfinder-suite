/**
 * Soft authorization warnings for WRT / IJP / Job Coaching.
 * Warnings and notifications only — never block time entry, billing, or casework.
 *
 * Rule: if clients.authorized_hours is null, show NO warnings and send NO
 * notifications (including end-date), even when authorization_end_date is set.
 *
 * Billed hours (all three services): same half-hour round-half-up per ES time
 * entry as IJP Billing lines (`roundIjpLineHoursFromMinutes`), counting entries
 * that pass `entryCountsTowardClientBillableWithActivity` (includes GVRA
 * monthly report allowance rows). Sum across the current client enrollment
 * (this clients row), not a single calendar month. Unlike monthly IJP invoice
 * packet totals, we do NOT ceil the period sum to whole hours — auth tracking
 * uses the sum of half-hour lines.
 *
 * Thresholds (derived from authorized hours):
 * - IJP (all variants = one service): early at authorized − 5; approaching at
 *   authorized − 2 (2-hour GVRA report allowance counts toward the auth, so
 *   effective direct-service budget is authorized − 2); exceeded when billed >
 *   authorized. Example: 15 authorized → early at 10, approaching at 13,
 *   exceeded above 15.
 * - WRT / Job Coaching (no report allowance): early at authorized − 5;
 *   approaching at authorized − 1 (one hour remaining); exceeded when billed >
 *   authorized.
 * Early / approaching only fire when the threshold is > 0.
 */

import { isIndividualJobPlacementServiceName } from "@wayfinder/branding";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  entryCountsTowardClientBillableWithActivity,
  parseServiceActivityTypeEmbed,
  type ClientBillableEntry,
} from "./client-billable";
import { roundIjpLineHoursFromMinutes } from "./ijp-billing-lines";
import { notifyUser } from "./notify-user";
import { serviceSupportsAuthorizedHoursFields } from "./referral-authorization-fields";
import { isMissingSchemaError } from "./schema-fallback";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";

export const IJP_GVRA_REPORT_ALLOWANCE_HOURS = 2;
export const AUTH_WARNING_EARLY_BUFFER_HOURS = 5;
/** IJP approaching = authorized − 2 (reserve report allowance in the budget). */
export const AUTH_WARNING_APPROACHING_BUFFER_IJP_HOURS = IJP_GVRA_REPORT_ALLOWANCE_HOURS;
/** WRT / Job Coaching approaching = authorized − 1 (one hour left). */
export const AUTH_WARNING_APPROACHING_BUFFER_OTHER_HOURS = 1;

export type AuthorizationHoursLevel = "early" | "approaching" | "exceeded";
export type AuthorizationWarningKind = AuthorizationHoursLevel | "end_date_passed";

export const AUTH_WARNING_KIND_EARLY = "auth_hours_early";
export const AUTH_WARNING_KIND_APPROACHING = "auth_hours_approaching";
export const AUTH_WARNING_KIND_EXCEEDED = "auth_hours_exceeded";
export const AUTH_WARNING_KIND_END_DATE = "auth_end_date_passed";

export type AuthorizationHoursThresholds = {
  isIjp: boolean;
  earlyAt: number;
  approachingAt: number;
  exceededAbove: number;
};

export type AuthorizationWarningEvaluation = {
  /** False when authorized_hours is null/invalid or the service does not use these fields. */
  applicable: boolean;
  authorizedHours: number | null;
  authorizationEndDate: string | null;
  billedHours: number;
  hoursLevel: AuthorizationHoursLevel | null;
  endDatePassed: boolean;
  /** Active warning kinds for UI (hours level + optional end date). */
  activeKinds: AuthorizationWarningKind[];
  thresholds: AuthorizationHoursThresholds | null;
  fingerprint: string | null;
};

export type AuthorizationWarningStateRow = {
  client_id: string;
  auth_fingerprint: string;
  notified_early: boolean;
  notified_approaching: boolean;
  notified_exceeded: boolean;
  notified_end_date_passed: boolean;
};

export function authorizationFingerprint(
  authorizedHours: number,
  authorizationEndDate: string | null | undefined
): string {
  return `${authorizedHours}|${(authorizationEndDate ?? "").trim().slice(0, 10)}`;
}

export function authorizationHoursThresholds(
  authorizedHours: number,
  serviceName: string | null | undefined
): AuthorizationHoursThresholds {
  const isIjp = isIndividualJobPlacementServiceName(serviceName);
  const approachingBuffer = isIjp
    ? AUTH_WARNING_APPROACHING_BUFFER_IJP_HOURS
    : AUTH_WARNING_APPROACHING_BUFFER_OTHER_HOURS;
  return {
    isIjp,
    earlyAt: authorizedHours - AUTH_WARNING_EARLY_BUFFER_HOURS,
    approachingAt: authorizedHours - approachingBuffer,
    exceededAbove: authorizedHours,
  };
}

/**
 * Pure evaluator. Returns no active warnings when authorized_hours is null —
 * including no end-date warning.
 */
export function evaluateAuthorizationWarnings(input: {
  authorizedHours: number | null | undefined;
  authorizationEndDate?: string | null;
  billedHours: number;
  serviceName?: string | null;
  /** America/New_York calendar date YYYY-MM-DD. */
  todayYmd: string;
}): AuthorizationWarningEvaluation {
  const endDate = (input.authorizationEndDate ?? null)?.trim().slice(0, 10) || null;
  const billedHours =
    Number.isFinite(input.billedHours) && input.billedHours > 0 ? Number(input.billedHours) : 0;

  if (input.authorizedHours == null) {
    return {
      applicable: false,
      authorizedHours: null,
      authorizationEndDate: endDate,
      billedHours,
      hoursLevel: null,
      endDatePassed: false,
      activeKinds: [],
      thresholds: null,
      fingerprint: null,
    };
  }

  const authorizedHours = Number(input.authorizedHours);
  if (!Number.isFinite(authorizedHours) || authorizedHours < 0) {
    return {
      applicable: false,
      authorizedHours: null,
      authorizationEndDate: endDate,
      billedHours,
      hoursLevel: null,
      endDatePassed: false,
      activeKinds: [],
      thresholds: null,
      fingerprint: null,
    };
  }

  if (!serviceSupportsAuthorizedHoursFields(input.serviceName)) {
    return {
      applicable: false,
      authorizedHours,
      authorizationEndDate: endDate,
      billedHours,
      hoursLevel: null,
      endDatePassed: false,
      activeKinds: [],
      thresholds: null,
      fingerprint: null,
    };
  }

  const thresholds = authorizationHoursThresholds(authorizedHours, input.serviceName);
  let hoursLevel: AuthorizationHoursLevel | null = null;
  if (billedHours > thresholds.exceededAbove) {
    hoursLevel = "exceeded";
  } else if (thresholds.approachingAt > 0 && billedHours >= thresholds.approachingAt) {
    hoursLevel = "approaching";
  } else if (thresholds.earlyAt > 0 && billedHours >= thresholds.earlyAt) {
    hoursLevel = "early";
  }

  const today = input.todayYmd.trim().slice(0, 10);
  const endDatePassed = Boolean(endDate && today && endDate < today);

  const activeKinds: AuthorizationWarningKind[] = [];
  if (hoursLevel) activeKinds.push(hoursLevel);
  if (endDatePassed) activeKinds.push("end_date_passed");

  return {
    applicable: true,
    authorizedHours,
    authorizationEndDate: endDate,
    billedHours,
    hoursLevel,
    endDatePassed,
    activeKinds,
    thresholds,
    fingerprint: authorizationFingerprint(authorizedHours, endDate),
  };
}

/** Sum of half-hour-rounded billable line hours (IJP Billing line rounding). */
export function sumAuthorizationBilledHoursFromEntries(
  entries: Array<
    ClientBillableEntry & {
      status?: string | null;
      service_activity_types?:
        | { code?: string | null; counts_toward_client_billable?: boolean | null }
        | { code?: string | null; counts_toward_client_billable?: boolean | null }[]
        | null;
    }
  >
): number {
  let sum = 0;
  for (const entry of entries) {
    if ((entry.status ?? "").toLowerCase() === "rejected") continue;
    const rawActivity = entry.service_activity_types ?? null;
    const normalizedActivity =
      rawActivity == null
        ? null
        : Array.isArray(rawActivity)
          ? rawActivity[0]
            ? {
                code: rawActivity[0].code ?? "",
                counts_toward_client_billable:
                  rawActivity[0].counts_toward_client_billable ?? undefined,
              }
            : null
          : {
              code: rawActivity.code ?? "",
              counts_toward_client_billable:
                rawActivity.counts_toward_client_billable ?? undefined,
            };
    const activity = parseServiceActivityTypeEmbed(normalizedActivity);
    if (!entryCountsTowardClientBillableWithActivity(entry, activity)) continue;
    sum += roundIjpLineHoursFromMinutes(entry.duration_minutes);
  }
  // Avoid FP dust (e.g. 0.1 + 0.2 style) while keeping half-hour precision.
  return Math.round(sum * 2) / 2;
}

export function authorizationWarningListLabel(
  evaluation: Pick<AuthorizationWarningEvaluation, "hoursLevel" | "endDatePassed" | "applicable">
): string | null {
  if (!evaluation.applicable) return null;
  const parts: string[] = [];
  if (evaluation.hoursLevel === "exceeded") parts.push("Auth hours exceeded");
  else if (evaluation.hoursLevel === "approaching") parts.push("Auth hours nearly used");
  else if (evaluation.hoursLevel === "early") parts.push("Auth hours watch");
  if (evaluation.endDatePassed) parts.push("Auth ended");
  return parts.length ? parts.join(" · ") : null;
}

export function authorizationWarningTone(
  evaluation: Pick<AuthorizationWarningEvaluation, "hoursLevel" | "endDatePassed" | "applicable">
): "none" | "info" | "warn" | "alert" {
  if (!evaluation.applicable) return "none";
  if (evaluation.hoursLevel === "exceeded" || evaluation.endDatePassed) return "alert";
  if (evaluation.hoursLevel === "approaching") return "warn";
  if (evaluation.hoursLevel === "early") return "info";
  return "none";
}

export function authorizationWarningBannerCopy(evaluation: AuthorizationWarningEvaluation): {
  title: string;
  body: string;
} | null {
  if (!evaluation.applicable || evaluation.activeKinds.length === 0) return null;
  const billed = evaluation.billedHours;
  const auth = evaluation.authorizedHours!;
  const lines: string[] = [];
  if (evaluation.hoursLevel === "exceeded") {
    lines.push(
      `Billed hours (${billed}) are above the authorized hours (${auth}). This is a soft warning only — work is not blocked.`
    );
  } else if (evaluation.hoursLevel === "approaching") {
    if (evaluation.thresholds?.isIjp) {
      lines.push(
        `Billed hours (${billed}) have reached the IJP service budget of ${evaluation.thresholds.approachingAt} (authorized ${auth} minus the 2-hour GVRA report allowance). Soft warning only.`
      );
    } else {
      lines.push(
        `Billed hours (${billed}) are within one hour of the authorized hours (${auth}). Soft warning only.`
      );
    }
  } else if (evaluation.hoursLevel === "early") {
    lines.push(
      `Billed hours (${billed}) are within 5 hours of the authorized hours (${auth}). Soft warning only.`
    );
  }
  if (evaluation.endDatePassed && evaluation.authorizationEndDate) {
    lines.push(
      `Authorization end date ${evaluation.authorizationEndDate} has passed (America/New_York). Soft warning only.`
    );
  }
  const title =
    evaluation.hoursLevel === "exceeded" || evaluation.endDatePassed
      ? "Authorization alert"
      : evaluation.hoursLevel === "approaching"
        ? "Authorization nearly used"
        : "Authorization watch";
  return { title, body: lines.join(" ") };
}

type TimeEntryRow = ClientBillableEntry & {
  client_id?: string;
  status?: string | null;
  service_activity_types?:
    | { code?: string | null; counts_toward_client_billable?: boolean | null }
    | { code?: string | null; counts_toward_client_billable?: boolean | null }[]
    | null;
};

export async function loadAuthorizationBilledHoursByClient(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const ids = [...new Set(clientIds.filter(Boolean))];
  for (const id of ids) out.set(id, 0);
  if (ids.length === 0) return out;

  const { data, error } = await admin
    .from("es_time_entries")
    .select(
      `client_id, duration_minutes, flags, client_present, delivery_mode, status,
       service_activity_types ( code, counts_toward_client_billable )`
    )
    .in("client_id", ids)
    .neq("status", "rejected");

  if (error) {
    console.error("loadAuthorizationBilledHoursByClient:", error.message);
    return out;
  }

  const byClient = new Map<string, TimeEntryRow[]>();
  for (const row of data ?? []) {
    const clientId = row.client_id as string;
    const list = byClient.get(clientId) ?? [];
    list.push(row as TimeEntryRow);
    byClient.set(clientId, list);
  }
  for (const [clientId, entries] of byClient) {
    out.set(clientId, sumAuthorizationBilledHoursFromEntries(entries));
  }
  return out;
}

async function loadWarningState(
  admin: SupabaseClient,
  clientId: string
): Promise<AuthorizationWarningStateRow | null> {
  const { data, error } = await admin
    .from("client_authorization_warning_state")
    .select(
      "client_id, auth_fingerprint, notified_early, notified_approaching, notified_exceeded, notified_end_date_passed"
    )
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    if (isMissingSchemaError(error.message)) return null;
    console.error("loadWarningState:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    client_id: data.client_id as string,
    auth_fingerprint: data.auth_fingerprint as string,
    notified_early: Boolean(data.notified_early),
    notified_approaching: Boolean(data.notified_approaching),
    notified_exceeded: Boolean(data.notified_exceeded),
    notified_end_date_passed: Boolean(data.notified_end_date_passed),
  };
}

async function upsertWarningState(
  admin: SupabaseClient,
  row: AuthorizationWarningStateRow
): Promise<void> {
  const { error } = await admin.from("client_authorization_warning_state").upsert(
    {
      client_id: row.client_id,
      auth_fingerprint: row.auth_fingerprint,
      notified_early: row.notified_early,
      notified_approaching: row.notified_approaching,
      notified_exceeded: row.notified_exceeded,
      notified_end_date_passed: row.notified_end_date_passed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" }
  );
  if (error && !isMissingSchemaError(error.message)) {
    console.error("upsertWarningState:", error.message);
  }
}

async function loadAssignedEsUserId(
  admin: SupabaseClient,
  clientId: string
): Promise<string | null> {
  const { data, error } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("loadAssignedEsUserId:", error.message);
    return null;
  }
  return (data?.es_user_id as string | null) ?? null;
}

function notificationPayloadForKind(
  kind: AuthorizationWarningKind,
  opts: {
    clientId: string;
    clientName: string;
    evaluation: AuthorizationWarningEvaluation;
  }
): { kind: string; title: string; body: string; link_path: string; metadata: Record<string, unknown> } {
  const link_path = `/dashboard/clients/${opts.clientId}`;
  const fingerprint = opts.evaluation.fingerprint;
  const baseMeta = {
    clientId: opts.clientId,
    authFingerprint: fingerprint,
    warningKind: kind,
  };
  if (kind === "early") {
    return {
      kind: AUTH_WARNING_KIND_EARLY,
      title: `Authorization watch: ${opts.clientName}`,
      body: `${opts.clientName} has ${opts.evaluation.billedHours} billed hours of ${opts.evaluation.authorizedHours} authorized (early soft warning).`,
      link_path,
      metadata: baseMeta,
    };
  }
  if (kind === "approaching") {
    return {
      kind: AUTH_WARNING_KIND_APPROACHING,
      title: `Authorization nearly used: ${opts.clientName}`,
      body: `${opts.clientName} has ${opts.evaluation.billedHours} billed hours of ${opts.evaluation.authorizedHours} authorized (approaching soft warning).`,
      link_path,
      metadata: baseMeta,
    };
  }
  if (kind === "exceeded") {
    return {
      kind: AUTH_WARNING_KIND_EXCEEDED,
      title: `Authorization exceeded: ${opts.clientName}`,
      body: `${opts.clientName} has ${opts.evaluation.billedHours} billed hours above the authorized ${opts.evaluation.authorizedHours} (soft warning — not blocked).`,
      link_path,
      metadata: baseMeta,
    };
  }
  return {
    kind: AUTH_WARNING_KIND_END_DATE,
    title: `Authorization ended: ${opts.clientName}`,
    body: `${opts.clientName}'s authorization end date (${opts.evaluation.authorizationEndDate}) has passed (America/New_York). Soft warning only.`,
    link_path,
    metadata: baseMeta,
  };
}

/**
 * Evaluate warnings for one client and notify the assigned ES/TS once per
 * threshold for the current authorization fingerprint. Soft warnings only.
 */
export async function syncClientAuthorizationWarnings(
  admin: SupabaseClient,
  opts: {
    clientId: string;
    authorizedHours: number | null | undefined;
    authorizationEndDate?: string | null;
    serviceName?: string | null;
    clientName?: string | null;
    billedHours?: number;
    todayYmd?: string;
    /** When false, only evaluate (no notify / state writes). Default true. */
    notify?: boolean;
  }
): Promise<AuthorizationWarningEvaluation> {
  const todayYmd =
    opts.todayYmd ?? localDateStringInTz(new Date(), STAFF_CLOCK_TIMEZONE);
  const billedHours =
    opts.billedHours ??
    (await loadAuthorizationBilledHoursByClient(admin, [opts.clientId])).get(opts.clientId) ??
    0;

  const evaluation = evaluateAuthorizationWarnings({
    authorizedHours: opts.authorizedHours,
    authorizationEndDate: opts.authorizationEndDate,
    billedHours,
    serviceName: opts.serviceName,
    todayYmd,
  });

  if (!evaluation.applicable || !evaluation.fingerprint || opts.notify === false) {
    return evaluation;
  }

  const esUserId = await loadAssignedEsUserId(admin, opts.clientId);
  if (!esUserId) return evaluation;

  const existing = await loadWarningState(admin, opts.clientId);
  const fingerprintChanged =
    !existing || existing.auth_fingerprint !== evaluation.fingerprint;
  let state: AuthorizationWarningStateRow = fingerprintChanged
    ? {
        client_id: opts.clientId,
        auth_fingerprint: evaluation.fingerprint,
        notified_early: false,
        notified_approaching: false,
        notified_exceeded: false,
        notified_end_date_passed: false,
      }
    : { ...existing! };

  const clientName = (opts.clientName ?? "").trim() || "Client";
  const pending: AuthorizationWarningKind[] = [];
  const thresholds = evaluation.thresholds;
  // Notify once for every threshold that has been crossed (including when billed
  // jumps over early into approaching/exceeded in one step).
  if (thresholds) {
    if (
      thresholds.earlyAt > 0 &&
      evaluation.billedHours >= thresholds.earlyAt &&
      !state.notified_early
    ) {
      pending.push("early");
    }
    if (
      thresholds.approachingAt > 0 &&
      evaluation.billedHours >= thresholds.approachingAt &&
      !state.notified_approaching
    ) {
      pending.push("approaching");
    }
    if (evaluation.billedHours > thresholds.exceededAbove && !state.notified_exceeded) {
      pending.push("exceeded");
    }
  }
  if (evaluation.endDatePassed && !state.notified_end_date_passed) {
    pending.push("end_date_passed");
  }

  for (const kind of pending) {
    const payload = notificationPayloadForKind(kind, {
      clientId: opts.clientId,
      clientName,
      evaluation,
    });
    await notifyUser(admin, {
      userId: esUserId,
      app: "staff",
      kind: payload.kind,
      title: payload.title,
      body: payload.body,
      link_path: payload.link_path,
      metadata: payload.metadata,
    });
    if (kind === "early") state.notified_early = true;
    if (kind === "approaching") state.notified_approaching = true;
    if (kind === "exceeded") state.notified_exceeded = true;
    if (kind === "end_date_passed") state.notified_end_date_passed = true;
  }

  // Persist when auth fields changed (reset) or when new thresholds were notified.
  if (fingerprintChanged || pending.length > 0) {
    await upsertWarningState(admin, state);
  }
  return evaluation;
}

export type ClientAuthWarningInput = {
  id: string;
  authorized_hours?: number | null;
  authorization_end_date?: string | null;
  serviceName?: string | null;
  displayName?: string | null;
};

/**
 * Batch evaluate (+ optional notify) for caseload / cron. Skips clients with
 * null authorized_hours entirely.
 */
export async function syncAuthorizationWarningsForClients(
  admin: SupabaseClient,
  clients: ClientAuthWarningInput[],
  opts?: { notify?: boolean; todayYmd?: string }
): Promise<Map<string, AuthorizationWarningEvaluation>> {
  const results = new Map<string, AuthorizationWarningEvaluation>();
  const todayYmd =
    opts?.todayYmd ?? localDateStringInTz(new Date(), STAFF_CLOCK_TIMEZONE);
  const notify = opts?.notify !== false;

  const candidates = clients.filter((c) => {
    if (c.authorized_hours == null) return false;
    if (!Number.isFinite(Number(c.authorized_hours))) return false;
    return serviceSupportsAuthorizedHoursFields(c.serviceName);
  });

  const billedByClient = await loadAuthorizationBilledHoursByClient(
    admin,
    candidates.map((c) => c.id)
  );

  for (const client of clients) {
    if (client.authorized_hours == null || !serviceSupportsAuthorizedHoursFields(client.serviceName)) {
      results.set(
        client.id,
        evaluateAuthorizationWarnings({
          authorizedHours: client.authorized_hours,
          authorizationEndDate: client.authorization_end_date,
          billedHours: 0,
          serviceName: client.serviceName,
          todayYmd,
        })
      );
      continue;
    }
    const evaluation = await syncClientAuthorizationWarnings(admin, {
      clientId: client.id,
      authorizedHours: client.authorized_hours,
      authorizationEndDate: client.authorization_end_date,
      serviceName: client.serviceName,
      clientName: client.displayName,
      billedHours: billedByClient.get(client.id) ?? 0,
      todayYmd,
      notify,
    });
    results.set(client.id, evaluation);
  }

  return results;
}

/**
 * Cron helper: scan clients that have authorized_hours set for supported services.
 */
export async function runAuthorizationWarningsScan(
  admin: SupabaseClient,
  opts?: { todayYmd?: string; limit?: number }
): Promise<{ scanned: number; notifiedClients: number }> {
  const limit = opts?.limit ?? 500;
  const { data: rows, error } = await admin
    .from("clients")
    .select(
      "id, full_name, authorized_hours, authorization_end_date, current_service_id, archived_at, intake_status"
    )
    .not("authorized_hours", "is", null)
    .is("archived_at", null)
    .neq("intake_status", "discarded")
    .limit(limit);

  if (error) {
    if (isMissingSchemaError(error.message)) {
      return { scanned: 0, notifiedClients: 0 };
    }
    throw new Error(error.message);
  }

  const serviceIds = [
    ...new Set(
      (rows ?? [])
        .map((r) => r.current_service_id as string | null)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const serviceNameById = new Map<string, string>();
  if (serviceIds.length > 0) {
    const { data: services } = await admin.from("services").select("id, name").in("id", serviceIds);
    for (const s of services ?? []) {
      serviceNameById.set(s.id as string, s.name as string);
    }
  }

  const inputs: ClientAuthWarningInput[] = (rows ?? []).map((r) => ({
    id: r.id as string,
    authorized_hours:
      r.authorized_hours == null ? null : Number(r.authorized_hours),
    authorization_end_date: (r.authorization_end_date as string | null) ?? null,
    serviceName: serviceNameById.get(r.current_service_id as string) ?? null,
    displayName: (r.full_name as string | null) ?? null,
  }));

  const beforeStates = new Map<string, AuthorizationWarningStateRow | null>();
  for (const c of inputs) {
    if (c.authorized_hours == null) continue;
    beforeStates.set(c.id, await loadWarningState(admin, c.id));
  }

  const evaluations = await syncAuthorizationWarningsForClients(admin, inputs, {
    notify: true,
    todayYmd: opts?.todayYmd,
  });

  let notifiedClients = 0;
  for (const [clientId, evaluation] of evaluations) {
    if (!evaluation.applicable || !evaluation.fingerprint) continue;
    const before = beforeStates.get(clientId);
    const after = await loadWarningState(admin, clientId);
    if (!after) continue;
    const newlyNotified =
      (!before || before.auth_fingerprint !== after.auth_fingerprint
        ? true
        : false) ||
      after.notified_early !== Boolean(before?.notified_early) ||
      after.notified_approaching !== Boolean(before?.notified_approaching) ||
      after.notified_exceeded !== Boolean(before?.notified_exceeded) ||
      after.notified_end_date_passed !== Boolean(before?.notified_end_date_passed);
    // Count clients that have any active warning after sync when state flags advanced.
    if (
      evaluation.activeKinds.length > 0 &&
      newlyNotified &&
      (after.notified_early ||
        after.notified_approaching ||
        after.notified_exceeded ||
        after.notified_end_date_passed)
    ) {
      notifiedClients += 1;
    }
  }

  return { scanned: inputs.length, notifiedClients };
}
