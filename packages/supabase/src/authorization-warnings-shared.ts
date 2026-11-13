/**
 * Client-safe soft authorization warning helpers (no Node-only imports).
 * Server notify / DB sync lives in authorization-warnings.ts.
 */

import { isIndividualJobPlacementServiceName } from "@wayfinder/branding";
import { serviceSupportsAuthorizedHoursFields } from "./referral-authorization-fields";

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

export type AuthorizationWarningListFlag = {
  label: string;
  tone: "none" | "info" | "warn" | "alert";
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

export function authorizationWarningListFlag(
  evaluation: AuthorizationWarningEvaluation
): AuthorizationWarningListFlag | null {
  const label = authorizationWarningListLabel(evaluation);
  if (!label) return null;
  return { label, tone: authorizationWarningTone(evaluation) };
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
