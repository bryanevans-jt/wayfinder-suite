import { createHash, timingSafeEqual } from "node:crypto";
import type { KraStaffComplianceRow } from "@wayfinder/supabase/kra-billable-compliance";
import { formatBillableHours } from "@wayfinder/supabase/client-billable";

export const KRA_SUMMARY_SECRET_HEADER = "x-careers-kra-secret";
export const KRA_SUMMARY_SECRET_ENV = "WAYFINDER_KRA_SHARED_SECRET";

const QUARTER_RE = /^(\d{4})-Q([1-4])$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** In-memory sliding window (same pattern as ijp-signature-flags-rate-limit). */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const hitsByKey = new Map<string, number[]>();

export type KraMonthSummary = {
  monthKey: string;
  monthLabel: string;
  frozen: boolean;
  complianceLabel: string;
  metCount: number;
  missedCount: number;
  inScopeClientCount: number;
  averageBillableHoursPerClient: string;
};

export type KraSummaryPayload = {
  email: string;
  quarter: string;
  months: KraMonthSummary[];
  summary: {
    monthsMet: number;
    monthsTotal: number;
    complianceLabel: string;
    metCount: number;
    inScopeClientCount: number;
    averageBillableHoursPerClient: string;
  };
};

/**
 * A month is "met" when every in-scope client met the billable-hour threshold
 * (100% of inScopeClientCount). Months with zero in-scope clients do not count
 * as met — there is no KRA card definition for monthsMet; this is the Careers
 * quarterly-review convention.
 */
export function isKraMonthMet(row: Pick<KraMonthSummary, "metCount" | "inScopeClientCount">): boolean {
  return row.inScopeClientCount > 0 && row.metCount === row.inScopeClientCount;
}

export function parseQuarterKey(raw: string | null | undefined): {
  quarter: string;
  monthKeys: string[];
} | null {
  const trimmed = (raw ?? "").trim();
  const m = QUARTER_RE.exec(trimmed);
  if (!m) return null;
  const year = Number(m[1]);
  const q = Number(m[2]);
  const startMonth = (q - 1) * 3 + 1;
  const monthKeys = [0, 1, 2].map(
    (i) => `${year}-${String(startMonth + i).padStart(2, "0")}`
  );
  return { quarter: `${year}-Q${q}`, monthKeys };
}

export function normalizeKraSummaryEmail(raw: string | null | undefined): string | null {
  const email = (raw ?? "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return null;
  return email;
}

/** Constant-time compare via SHA-256 digests (length-independent). */
export function careersKraSecretsEqual(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function kraSummaryRateLimited(key: string, now = Date.now()): boolean {
  const cutoff = now - RATE_WINDOW_MS;
  const prev = hitsByKey.get(key) ?? [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= RATE_MAX_REQUESTS) {
    hitsByKey.set(key, recent);
    return true;
  }
  recent.push(now);
  hitsByKey.set(key, recent);
  return false;
}

/** Test helper — clears in-memory counters. */
export function resetKraSummaryRateLimitForTests(): void {
  hitsByKey.clear();
}

export function staffRowToMonthSummary(
  monthKey: string,
  monthLabel: string,
  frozen: boolean,
  row: Pick<
    KraStaffComplianceRow,
    | "metCount"
    | "missedCount"
    | "inScopeClientCount"
    | "complianceLabel"
    | "averageBillableHoursPerClient"
  >
): KraMonthSummary {
  return {
    monthKey,
    monthLabel,
    frozen,
    complianceLabel: row.complianceLabel,
    metCount: row.metCount,
    missedCount: row.missedCount,
    inScopeClientCount: row.inScopeClientCount,
    averageBillableHoursPerClient: row.averageBillableHoursPerClient,
  };
}

export function buildKraSummaryPayload(
  email: string,
  quarter: string,
  months: KraMonthSummary[]
): KraSummaryPayload {
  const monthsMet = months.filter(isKraMonthMet).length;
  const monthsTotal = months.length;
  const metCount = months.reduce((s, m) => s + m.metCount, 0);
  const inScopeClientCount = months.reduce((s, m) => s + m.inScopeClientCount, 0);
  let weightedHours = 0;
  for (const m of months) {
    const avg = Number.parseFloat(m.averageBillableHoursPerClient);
    if (Number.isFinite(avg) && m.inScopeClientCount > 0) {
      weightedHours += avg * m.inScopeClientCount;
    }
  }
  const averageBillableHoursPerClient =
    inScopeClientCount > 0
      ? formatBillableHours((weightedHours / inScopeClientCount) * 60)
      : "0.0";

  return {
    email,
    quarter,
    months,
    summary: {
      monthsMet,
      monthsTotal,
      complianceLabel: `${metCount} / ${inScopeClientCount}`,
      metCount,
      inScopeClientCount,
      averageBillableHoursPerClient,
    },
  };
}

export function emptyStaffComplianceRow(staffUserId: string): KraStaffComplianceRow {
  return {
    staffUserId,
    staffName: "Team member",
    role: null,
    inScopeClientCount: 0,
    metCount: 0,
    missedCount: 0,
    complianceLabel: "0 / 0",
    averageBillableHoursPerClient: "0.0",
    expectedBillableMinutes: 0,
    expectedBillableHours: "0.0",
    clients: [],
  };
}
