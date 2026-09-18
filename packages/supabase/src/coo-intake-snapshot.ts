import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isGaTseService,
  isPhase1IntakeStage,
} from "./referral-intake";

const MS_DAY = 24 * 60 * 60 * 1000;

export type CooIntakeSnapshot = {
  generatedAt: string;
  queue: {
    newReferral: number;
    pendingAuthorization: number;
    totalPipeline: number;
    oldestReferredAt: string | null;
    medianDaysInQueue: number | null;
  };
  sla: {
    stuckOver7Days: number;
    stuckSample: Array<{
      id: string;
      fullName: string | null;
      intakeStatus: string;
      referredAt: string | null;
      intakeStatusChangedAt: string | null;
      daysSinceReferred: number | null;
      daysSinceStatusChange: number | null;
    }>;
  };
  funnel: {
    activationsLast7Days: number;
    referralsCreatedLast7Days: number;
    scheduledIntakesWithoutBillingReady: number;
  };
  errors: {
    last24Hours: number;
    last7Days: number;
  };
};

function daysSince(iso: string | null | undefined, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.floor((nowMs - t) / MS_DAY);
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export async function loadCooIntakeSnapshot(
  admin: SupabaseClient
): Promise<CooIntakeSnapshot> {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const sevenDaysAgo = new Date(nowMs - 7 * MS_DAY).toISOString();
  const slaCutoff = new Date(nowMs - 7 * MS_DAY).toISOString();
  const since24h = new Date(nowMs - MS_DAY).toISOString();

  const { data: pipeline } = await admin
    .from("clients")
    .select(
      "id, full_name, intake_status, referred_at, intake_status_changed_at, referral_state"
    )
    .in("intake_status", ["new_referral", "pending_authorization"])
    .limit(500);

  const pipelineRows = (pipeline ?? []).filter(
    (r) => ((r.referral_state as string | null) ?? "GA").trim().toUpperCase() !== "TN"
  );

  let newReferral = 0;
  let pendingAuthorization = 0;
  let oldestReferredMs: number | null = null;
  const queueAges: number[] = [];

  for (const row of pipelineRows) {
    const status = row.intake_status as string;
    if (status === "new_referral") newReferral += 1;
    if (status === "pending_authorization") pendingAuthorization += 1;
    const referredAt = row.referred_at as string | null;
    if (referredAt) {
      const t = Date.parse(referredAt);
      if (!Number.isNaN(t)) {
        if (oldestReferredMs == null || t < oldestReferredMs) oldestReferredMs = t;
        queueAges.push(Math.floor((nowMs - t) / MS_DAY));
      }
    }
  }

  const { data: stuckCandidates } = await admin
    .from("clients")
    .select("id, full_name, intake_status, referred_at, intake_status_changed_at, current_service_id, current_stage_id, referral_state")
    .in("intake_status", ["new_referral", "pending_authorization", "active"])
    .lt("intake_status_changed_at", slaCutoff)
    .neq("referral_state", "TN")
    .limit(200);

  const stuckSample: CooIntakeSnapshot["sla"]["stuckSample"] = [];
  let stuckOver7Days = 0;

  for (const client of stuckCandidates ?? []) {
    if ((client.referral_state as string | null) === "TN") continue;
    const status = client.intake_status as string;
    let include = status === "new_referral" || status === "pending_authorization";
    if (status === "active") {
      const ga = await isGaTseService(admin, client.current_service_id as string);
      const p1 = await isPhase1IntakeStage(admin, client.current_stage_id as string);
      include = ga && p1;
    }
    if (!include) continue;
    stuckOver7Days += 1;
    if (stuckSample.length < 12) {
      stuckSample.push({
        id: client.id as string,
        fullName: (client.full_name as string | null) ?? null,
        intakeStatus: status,
        referredAt: (client.referred_at as string | null) ?? null,
        intakeStatusChangedAt: (client.intake_status_changed_at as string | null) ?? null,
        daysSinceReferred: daysSince(client.referred_at as string | null, nowMs),
        daysSinceStatusChange: daysSince(client.intake_status_changed_at as string | null, nowMs),
      });
    }
  }

  const [{ count: activations7d }, { count: referrals7d }] = await Promise.all([
    admin
      .from("client_intake_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "activated")
      .gte("created_at", sevenDaysAgo),
    admin
      .from("client_intake_events")
      .select("id", { count: "exact", head: true })
      .in("event_type", ["referral_submitted", "returning_client_referral_created"])
      .gte("created_at", sevenDaysAgo),
  ]);

  const { count: scheduledNotReady } = await admin
    .from("intake_billings")
    .select("id", { count: "exact", head: true })
    .eq("status", "scheduled");

  const [{ count: err24 }, { count: err7 }] = await Promise.all([
    admin
      .from("system_error_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since24h),
    admin
      .from("system_error_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sevenDaysAgo),
  ]);

  return {
    generatedAt: nowIso,
    queue: {
      newReferral,
      pendingAuthorization,
      totalPipeline: newReferral + pendingAuthorization,
      oldestReferredAt: oldestReferredMs ? new Date(oldestReferredMs).toISOString() : null,
      medianDaysInQueue: median(queueAges),
    },
    sla: {
      stuckOver7Days,
      stuckSample,
    },
    funnel: {
      activationsLast7Days: activations7d ?? 0,
      referralsCreatedLast7Days: referrals7d ?? 0,
      scheduledIntakesWithoutBillingReady: scheduledNotReady ?? 0,
    },
    errors: {
      last24Hours: err24 ?? 0,
      last7Days: err7 ?? 0,
    },
  };
}
