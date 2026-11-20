import type { SupabaseClient } from "@supabase/supabase-js";
import { NO_CONTACT_DAYS } from "./caseload-triage";
import {
  assigneesOverlappingMonth,
  calendarMonthBoundsFromKey,
  type AssignmentEventRow,
} from "./es-client-assignment-events";
import { loadKraBillableComplianceRollup } from "./kra-billable-compliance";
import { localDateStringInTz, STAFF_CLOCK_TIMEZONE } from "./staff-time-clock-shared";
import {
  CAREER_PLACEMENT_TIERS,
  KRA_PERCENT_TIERS,
  PLACEMENT_MONTH_TIERS,
  STAFF_BADGE_MIN_CLIENTS,
  badgeDescription,
  badgeLabel,
  careerPlacementBadgeKey,
  computeMonthStreaks,
  countPlacementsInMonth,
  everyClientContactedInMonth,
  isNewPersonalBest,
  kraBadgeKey,
  kraTiersEarned,
  monthKeysInclusive,
  noFourteenDayGapsInMonth,
  placementBadgeKey,
  placementTiersEarned,
  previousMonthKey,
  type StaffBadgeKey,
  type StaffBadgeProgress,
  type StaffBadgeStreakSummary,
} from "./staff-badges-shared";

export type StaffBadgeRow = {
  badge_key: string;
  period_key: string;
  earned_at: string;
  meta: Record<string, unknown>;
};

export type StaffBadgesMinePayload = {
  monthKey: string;
  monthLabel: string;
  medallions: StaffBadgeProgress[];
  streaks: StaffBadgeStreakSummary[];
  earned: Array<{
    badgeKey: string;
    label: string;
    description: string;
    periodKey: string;
    earnedAt: string;
  }>;
};

function monthLabelFromKey(monthKey: string): string {
  const { start } = calendarMonthBoundsFromKey(monthKey);
  const [y, m, d] = start.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

export function currentNyMonthKey(now: Date = new Date()): string {
  return localDateStringInTz(now, STAFF_CLOCK_TIMEZONE).slice(0, 7);
}

export function currentNyDateYmd(now: Date = new Date()): string {
  return localDateStringInTz(now, STAFF_CLOCK_TIMEZONE);
}

async function upsertBadge(
  admin: SupabaseClient,
  staffUserId: string,
  badgeKey: string,
  periodKey: string,
  meta: Record<string, unknown> = {}
): Promise<boolean> {
  const { error } = await admin.from("staff_badges").upsert(
    {
      staff_user_id: staffUserId,
      badge_key: badgeKey,
      period_key: periodKey,
      meta,
      // Do not overwrite earned_at on conflict — freeze first award time.
    },
    { onConflict: "staff_user_id,badge_key,period_key", ignoreDuplicates: true }
  );
  if (error) {
    console.error("[staff_badges] upsert failed:", error.message);
    return false;
  }
  return true;
}

async function loadExistingBadges(
  admin: SupabaseClient,
  staffUserId: string
): Promise<StaffBadgeRow[]> {
  const { data, error } = await admin
    .from("staff_badges")
    .select("badge_key, period_key, earned_at, meta")
    .eq("staff_user_id", staffUserId);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((r) => ({
    badge_key: r.badge_key as string,
    period_key: (r.period_key as string) ?? "",
    earned_at: r.earned_at as string,
    meta: (r.meta as Record<string, unknown>) ?? {},
  }));
}

type ClientLite = {
  id: string;
  job_start_date: string | null;
  archived_at: string | null;
  intake_status: string | null;
  is_demo: boolean | null;
};

function isEligibleClient(c: ClientLite, monthStart: string): boolean {
  if (c.is_demo === true) return false;
  if ((c.intake_status ?? "").trim().toLowerCase() === "discarded") return false;
  const archived = c.archived_at;
  if (archived && archived.slice(0, 10) < monthStart) return false;
  return true;
}

async function loadAssignmentEventsByClient(
  admin: SupabaseClient,
  clientIds: string[]
): Promise<Map<string, AssignmentEventRow[]>> {
  const out = new Map<string, AssignmentEventRow[]>();
  if (clientIds.length === 0) return out;
  const { data } = await admin
    .from("es_client_assignment_events")
    .select("client_id, es_user_id, effective_at")
    .in("client_id", clientIds)
    .order("effective_at", { ascending: true });
  for (const row of data ?? []) {
    const cid = row.client_id as string;
    const list = out.get(cid) ?? [];
    list.push({
      client_id: cid,
      es_user_id: row.es_user_id as string,
      effective_at: row.effective_at as string,
    });
    out.set(cid, list);
  }
  return out;
}

async function loadContactsInRange(
  admin: SupabaseClient,
  staffUserId: string,
  clientIds: string[],
  startYmd: string,
  endYmd: string
): Promise<{ byClientYmds: Map<string, string[]>; contactedInMonth: Set<string> }> {
  const byClientYmds = new Map<string, string[]>();
  const contactedInMonth = new Set<string>();
  if (clientIds.length === 0) {
    return { byClientYmds, contactedInMonth };
  }

  // Include a lookback window so month-open coverage can use prior contacts.
  const lookbackStart = new Date(`${startYmd}T12:00:00.000Z`);
  lookbackStart.setUTCDate(lookbackStart.getUTCDate() - (NO_CONTACT_DAYS + 2));
  const lookbackIso = lookbackStart.toISOString();

  const { data } = await admin
    .from("contact_logs")
    .select("client_id, created_at, logged_by, es_id")
    .in("client_id", clientIds)
    .gte("created_at", lookbackIso)
    .lte("created_at", `${endYmd}T23:59:59.999Z`);

  for (const row of data ?? []) {
    const loggedBy = (row.logged_by as string | null) ?? (row.es_id as string | null);
    if (loggedBy !== staffUserId) continue;
    const cid = row.client_id as string;
    const ymd = localDateStringInTz(new Date(row.created_at as string), STAFF_CLOCK_TIMEZONE);
    const list = byClientYmds.get(cid) ?? [];
    list.push(ymd);
    byClientYmds.set(cid, list);
    if (ymd >= startYmd && ymd <= endYmd) {
      contactedInMonth.add(cid);
    }
  }
  return { byClientYmds, contactedInMonth };
}

type MonthEval = {
  monthKey: string;
  placementCount: number;
  kraMet: number;
  kraInScope: number;
  kraTiers: number[];
  everyContacted: boolean;
  noGaps: boolean;
  caseloadCount: number;
};

async function evaluateStaffMonth(
  admin: SupabaseClient,
  staffUserId: string,
  monthKey: string,
  asOfYmd: string
): Promise<MonthEval> {
  const { start, end } = calendarMonthBoundsFromKey(monthKey);
  const windowEnd = asOfYmd < end ? asOfYmd : end;

  // Clients this specialist touched via assignment history (cheap filter via events).
  const { data: eventRows } = await admin
    .from("es_client_assignment_events")
    .select("client_id")
    .eq("es_user_id", staffUserId);
  const candidateIds = [...new Set((eventRows ?? []).map((r) => r.client_id as string))];

  let clients: ClientLite[] = [];
  if (candidateIds.length > 0) {
    const { data } = await admin
      .from("clients")
      .select("id, job_start_date, archived_at, intake_status, is_demo")
      .in("id", candidateIds);
    clients = (data ?? []) as ClientLite[];
  }

  const eligible = clients.filter((c) => isEligibleClient(c, start));
  const eligibleIds = eligible.map((c) => c.id);
  const eventsByClient = await loadAssignmentEventsByClient(admin, eligibleIds);

  const caseloadIds = eligibleIds.filter((id) => {
    const events = eventsByClient.get(id) ?? [];
    return assigneesOverlappingMonth(events, monthKey).includes(staffUserId);
  });

  const jobStarts = new Map<string, string>();
  for (const c of eligible) {
    if (c.job_start_date) jobStarts.set(c.id, c.job_start_date.slice(0, 10));
  }

  const placementCount = countPlacementsInMonth({
    staffUserId,
    monthKey,
    jobStarts,
    eventsByClient,
  });

  const nameByStaffId = new Map([[staffUserId, "Team member"]]);
  const rollup = await loadKraBillableComplianceRollup(
    admin,
    monthKey,
    nameByStaffId,
    new Map()
  );
  const kraRow = rollup.rows.find((r) => r.staffUserId === staffUserId);
  const kraMet = kraRow?.metCount ?? 0;
  const kraInScope = kraRow?.inScopeClientCount ?? 0;
  const kraTiers = kraTiersEarned(kraMet, kraInScope);

  const { byClientYmds, contactedInMonth } = await loadContactsInRange(
    admin,
    staffUserId,
    caseloadIds,
    start,
    windowEnd
  );

  const everyContacted = everyClientContactedInMonth({
    caseloadClientIds: caseloadIds,
    contactedClientIds: contactedInMonth,
  });
  const noGaps = noFourteenDayGapsInMonth({
    caseloadClientIds: caseloadIds,
    contactYmdsByClient: byClientYmds,
    windowStart: start,
    windowEnd,
  });

  return {
    monthKey,
    placementCount,
    kraMet,
    kraInScope,
    kraTiers,
    everyContacted,
    noGaps,
    caseloadCount: caseloadIds.length,
  };
}

async function freezeMonthAwards(
  admin: SupabaseClient,
  staffUserId: string,
  evalResult: MonthEval,
  priorPlacementCounts: number[],
  lifetimeBefore: number
): Promise<void> {
  const { monthKey, placementCount } = evalResult;

  for (const tier of placementTiersEarned(placementCount)) {
    await upsertBadge(admin, staffUserId, placementBadgeKey(tier), monthKey, {
      count: placementCount,
    });
  }

  for (const tier of evalResult.kraTiers) {
    await upsertBadge(admin, staffUserId, kraBadgeKey(tier), monthKey, {
      metCount: evalResult.kraMet,
      inScopeClientCount: evalResult.kraInScope,
    });
  }

  if (evalResult.everyContacted) {
    await upsertBadge(admin, staffUserId, "every_client_contacted", monthKey, {
      caseloadCount: evalResult.caseloadCount,
    });
  }
  if (evalResult.noGaps) {
    await upsertBadge(admin, staffUserId, "no_14_day_gaps", monthKey, {
      caseloadCount: evalResult.caseloadCount,
    });
  }

  if (placementCount > 0 && lifetimeBefore === 0) {
    await upsertBadge(admin, staffUserId, "first_placement", "", {
      monthKey,
    });
  }

  const lifetimeAfter = lifetimeBefore + placementCount;
  for (const tier of CAREER_PLACEMENT_TIERS) {
    if (lifetimeBefore < tier && lifetimeAfter >= tier) {
      await upsertBadge(admin, staffUserId, careerPlacementBadgeKey(tier), "", {
        count: lifetimeAfter,
        monthKey,
      });
    }
  }

  if (isNewPersonalBest(placementCount, priorPlacementCounts)) {
    await upsertBadge(admin, staffUserId, "personal_best", monthKey, {
      count: placementCount,
    });
  }
}

function lifetimePlacementsFromBadges(rows: StaffBadgeRow[]): number {
  // Sum max placement count per month from placements_* meta, else count months with placements_1.
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (!r.period_key) continue;
    if (!r.badge_key.startsWith("placements_")) continue;
    const count = Number(r.meta?.count);
    const tier = Number(r.badge_key.replace("placements_", ""));
    const n = Number.isFinite(count) && count > 0 ? count : tier;
    byMonth.set(r.period_key, Math.max(byMonth.get(r.period_key) ?? 0, n));
  }
  let sum = 0;
  for (const n of byMonth.values()) sum += n;
  return sum;
}

function priorMonthPlacementCounts(
  rows: StaffBadgeRow[],
  beforeMonth: string
): number[] {
  const byMonth = new Map<string, number>();
  for (const r of rows) {
    if (!r.period_key || r.period_key >= beforeMonth) continue;
    if (!r.badge_key.startsWith("placements_")) continue;
    const count = Number(r.meta?.count);
    const tier = Number(r.badge_key.replace("placements_", ""));
    const n = Number.isFinite(count) && count > 0 ? count : tier;
    byMonth.set(r.period_key, Math.max(byMonth.get(r.period_key) ?? 0, n));
  }
  return [...byMonth.values()];
}

/**
 * Lazily freeze closed months for one specialist (cheap: skips months already awarded).
 * Does not use Pre-ETS tables — ES/TS caseload + KRA rollup + contact_logs only.
 */
export async function awardClosedMonthsForStaff(
  admin: SupabaseClient,
  staffUserId: string,
  opts?: { lookbackMonths?: number; now?: Date }
): Promise<{ awardedMonths: string[] }> {
  const now = opts?.now ?? new Date();
  const currentMonth = currentNyMonthKey(now);
  const lookback = opts?.lookbackMonths ?? 18;
  let from = currentMonth;
  for (let i = 0; i < lookback; i++) from = previousMonthKey(from);
  const closedKeys = monthKeysInclusive(from, previousMonthKey(currentMonth));

  let rows = await loadExistingBadges(admin, staffUserId);
  const awardedMonths: string[] = [];

  for (const monthKey of closedKeys) {
    const already =
      rows.some((r) => r.period_key === monthKey && r.badge_key.startsWith("placements_")) ||
      rows.some((r) => r.period_key === monthKey && r.badge_key.startsWith("kra_")) ||
      rows.some(
        (r) =>
          r.period_key === monthKey &&
          (r.badge_key === "every_client_contacted" || r.badge_key === "no_14_day_gaps")
      );

    // Skip if we already evaluated this month (any monthly badge or a sentinel).
    // Use a sentinel freeze marker so empty months are not re-scanned forever.
    const hasSentinel = rows.some(
      (r) => r.period_key === monthKey && r.badge_key === "month_evaluated"
    );
    if (already || hasSentinel) continue;

    const { end } = calendarMonthBoundsFromKey(monthKey);
    const evalResult = await evaluateStaffMonth(admin, staffUserId, monthKey, end);
    const lifetimeBefore = lifetimePlacementsFromBadges(rows);
    const priors = priorMonthPlacementCounts(rows, monthKey);
    await freezeMonthAwards(admin, staffUserId, evalResult, priors, lifetimeBefore);
    await upsertBadge(admin, staffUserId, "month_evaluated", monthKey, {
      placementCount: evalResult.placementCount,
      caseloadCount: evalResult.caseloadCount,
    });
    awardedMonths.push(monthKey);
    rows = await loadExistingBadges(admin, staffUserId);
  }

  return { awardedMonths };
}

function buildMedallions(
  current: MonthEval,
  earnedKeys: Set<string>
): StaffBadgeProgress[] {
  const medallions: StaffBadgeProgress[] = [];

  // Placement ladder — show next unearned tier (or top earned).
  const placementEarned = placementTiersEarned(current.placementCount);
  const nextPlacement =
    PLACEMENT_MONTH_TIERS.find((t) => !placementEarned.includes(t)) ??
    PLACEMENT_MONTH_TIERS[PLACEMENT_MONTH_TIERS.length - 1];
  const placementKey = placementBadgeKey(nextPlacement);
  medallions.push({
    badgeKey: placementKey,
    label: badgeLabel(placementKey),
    description: badgeDescription(placementKey),
    earned: placementEarned.includes(nextPlacement) || earnedKeys.has(`${placementKey}:${current.monthKey}`),
    progress: Math.min(1, current.placementCount / nextPlacement),
    detail: `${current.placementCount} of ${nextPlacement}`,
  });

  // KRA ladder
  const kraEarned = current.kraTiers;
  const nextKra =
    KRA_PERCENT_TIERS.find((t) => !kraEarned.includes(t)) ??
    KRA_PERCENT_TIERS[KRA_PERCENT_TIERS.length - 1];
  const kraKey = kraBadgeKey(nextKra);
  const kraPct =
    current.kraInScope >= STAFF_BADGE_MIN_CLIENTS
      ? (current.kraMet / current.kraInScope) * 100
      : 0;
  medallions.push({
    badgeKey: kraKey,
    label: badgeLabel(kraKey),
    description: badgeDescription(kraKey),
    earned: kraEarned.includes(nextKra),
    progress:
      current.kraInScope >= STAFF_BADGE_MIN_CLIENTS
        ? Math.min(1, kraPct / nextKra)
        : 0,
    detail:
      current.kraInScope >= STAFF_BADGE_MIN_CLIENTS
        ? `${current.kraMet} of ${current.kraInScope}`
        : `Need ${STAFF_BADGE_MIN_CLIENTS}+ clients`,
  });

  const contactProgress =
    current.caseloadCount >= STAFF_BADGE_MIN_CLIENTS
      ? current.everyContacted
        ? 1
        : 0.5
      : current.caseloadCount / STAFF_BADGE_MIN_CLIENTS;
  medallions.push({
    badgeKey: "every_client_contacted",
    label: badgeLabel("every_client_contacted"),
    description: badgeDescription("every_client_contacted"),
    earned: current.everyContacted,
    progress: Math.min(1, contactProgress),
    detail:
      current.caseloadCount >= STAFF_BADGE_MIN_CLIENTS
        ? current.everyContacted
          ? "Complete"
          : "In progress"
        : `Need ${STAFF_BADGE_MIN_CLIENTS}+ clients`,
  });

  medallions.push({
    badgeKey: "no_14_day_gaps",
    label: badgeLabel("no_14_day_gaps"),
    description: badgeDescription("no_14_day_gaps"),
    earned: current.noGaps,
    progress: current.noGaps
      ? 1
      : current.caseloadCount >= STAFF_BADGE_MIN_CLIENTS
        ? 0.4
        : current.caseloadCount / STAFF_BADGE_MIN_CLIENTS,
    detail:
      current.caseloadCount >= STAFF_BADGE_MIN_CLIENTS
        ? current.noGaps
          ? "On track"
          : "Keep contacting"
        : `Need ${STAFF_BADGE_MIN_CLIENTS}+ clients`,
  });

  // Lifetime highlights if earned
  for (const key of [
    "first_placement",
    "career_placements_25",
    "career_placements_50",
    "career_placements_100",
  ] as StaffBadgeKey[]) {
    if (earnedKeys.has(`${key}:`)) {
      medallions.push({
        badgeKey: key,
        label: badgeLabel(key),
        description: badgeDescription(key),
        earned: true,
        progress: 1,
      });
    }
  }

  return medallions;
}

export async function loadStaffBadgesMine(
  admin: SupabaseClient,
  staffUserId: string,
  opts?: { now?: Date; awardClosed?: boolean }
): Promise<StaffBadgesMinePayload> {
  const now = opts?.now ?? new Date();
  const monthKey = currentNyMonthKey(now);
  const today = currentNyDateYmd(now);

  if (opts?.awardClosed !== false) {
    await awardClosedMonthsForStaff(admin, staffUserId, { now });
  }

  const rows = await loadExistingBadges(admin, staffUserId);
  const earnedKeys = new Set(rows.map((r) => `${r.badge_key}:${r.period_key}`));

  const current = await evaluateStaffMonth(admin, staffUserId, monthKey, today);

  const kraMonths = rows
    .filter((r) => r.badge_key === "kra_100" && r.period_key)
    .map((r) => r.period_key);
  if (current.kraTiers.includes(100)) kraMonths.push(monthKey);

  const placementMonths = rows
    .filter((r) => r.badge_key === "placements_1" && r.period_key)
    .map((r) => r.period_key);
  if (current.placementCount >= 1) placementMonths.push(monthKey);

  const kraStreak = computeMonthStreaks(kraMonths, monthKey);
  const placementStreak = computeMonthStreaks(placementMonths, monthKey);

  const streaks: StaffBadgeStreakSummary[] = [
    {
      kind: "kra",
      label: "KRA complete streak",
      current: kraStreak.current,
      best: kraStreak.best,
    },
    {
      kind: "placements",
      label: "Placement streak",
      current: placementStreak.current,
      best: placementStreak.best,
    },
  ];

  const earned = rows
    .filter((r) => r.badge_key !== "month_evaluated")
    .map((r) => ({
      badgeKey: r.badge_key,
      label: badgeLabel(r.badge_key),
      description: badgeDescription(r.badge_key),
      periodKey: r.period_key,
      earnedAt: r.earned_at,
    }))
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));

  return {
    monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    medallions: buildMedallions(current, earnedKeys),
    streaks,
    earned,
  };
}

/** Cron helper: award prior closed month for all active ES/TS. */
export async function awardPriorMonthForAllFieldSpecialists(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<{ staffProcessed: number; monthsTouched: number }> {
  const { data: profiles } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["es", "transition_specialist"])
    .neq("is_active", false);

  let monthsTouched = 0;
  for (const p of profiles ?? []) {
    const result = await awardClosedMonthsForStaff(admin, p.id as string, {
      now,
      lookbackMonths: 2,
    });
    monthsTouched += result.awardedMonths.length;
  }
  return { staffProcessed: (profiles ?? []).length, monthsTouched };
}

/** Deterministic mock payload for UI demos / screenshots (no client data). */
export function mockStaffBadgesMinePayload(): StaffBadgesMinePayload {
  return {
    monthKey: "2026-11",
    monthLabel: "November 2026",
    medallions: [
      {
        badgeKey: "placements_2",
        label: badgeLabel("placements_2"),
        description: badgeDescription("placements_2"),
        earned: false,
        progress: 0.5,
        detail: "1 of 2",
      },
      {
        badgeKey: "kra_100",
        label: badgeLabel("kra_100"),
        description: badgeDescription("kra_100"),
        earned: true,
        progress: 1,
        detail: "5 of 5",
      },
      {
        badgeKey: "every_client_contacted",
        label: badgeLabel("every_client_contacted"),
        description: badgeDescription("every_client_contacted"),
        earned: true,
        progress: 1,
        detail: "Complete",
      },
      {
        badgeKey: "no_14_day_gaps",
        label: badgeLabel("no_14_day_gaps"),
        description: badgeDescription("no_14_day_gaps"),
        earned: false,
        progress: 0.4,
        detail: "Keep contacting",
      },
      {
        badgeKey: "first_placement",
        label: badgeLabel("first_placement"),
        description: badgeDescription("first_placement"),
        earned: true,
        progress: 1,
      },
    ],
    streaks: [
      { kind: "kra", label: "KRA complete streak", current: 3, best: 5 },
      { kind: "placements", label: "Placement streak", current: 2, best: 4 },
    ],
    earned: [],
  };
}
