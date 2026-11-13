/**
 * Optional authorized hours + authorization end date for WRT / IJP / Job Coaching.
 * One client row = one current service enrollment; Begin New Service creates a new row.
 */

import {
  canViewClientProfiles,
  isAdminRole,
  isAdminTierRole,
  isFieldSpecialistRole,
  isHrRole,
  isSuperAdminRole,
  isSupervisorRole,
  isSupervisorTierRole,
} from "./roles";

/** Same set as canManageReferrals — kept local to avoid a circular import. */
function isReferralManagerRole(role: string | null | undefined): boolean {
  return isHrRole(role) || isAdminRole(role) || isSuperAdminRole(role) || isAdminTierRole(role);
}

/** True when the service (catalog name or referral form label) uses these fields. */
export function serviceSupportsAuthorizedHoursFields(
  serviceNameOrLabel: string | null | undefined
): boolean {
  const n = (serviceNameOrLabel ?? "").trim().toLowerCase();
  if (!n) return false;
  if (n.includes("workplace readiness") || n.includes("job readiness")) return true;
  if (n.includes("individual job placement")) return true;
  if (n.includes("job coaching")) return true;
  return false;
}

export type ParseAuthorizedHoursResult =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

/** Empty / null → null (optional). Rejects negatives and non-numeric input. */
export function parseAuthorizedHours(raw: unknown): ParseAuthorizedHoursResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) {
      return { ok: false, error: "Authorized hours must be a valid number." };
    }
    if (raw < 0) {
      return { ok: false, error: "Authorized hours cannot be negative." };
    }
    return { ok: true, value: raw };
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return { ok: true, value: null };
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      return { ok: false, error: "Authorized hours must be a valid number." };
    }
    if (n < 0) {
      return { ok: false, error: "Authorized hours cannot be negative." };
    }
    return { ok: true, value: n };
  }
  return { ok: false, error: "Authorized hours must be a valid number." };
}

export type ParseAuthorizationEndDateResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Empty / null → null (optional). Requires a real calendar YYYY-MM-DD date. */
export function parseAuthorizationEndDate(raw: unknown): ParseAuthorizationEndDateResult {
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Authorization end date must be a valid date." };
  }
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!ISO_DATE.test(trimmed)) {
    return { ok: false, error: "Authorization end date must be a valid date (YYYY-MM-DD)." };
  }
  const [y, m, d] = trimmed.split("-").map((p) => Number(p));
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m! - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false, error: "Authorization end date must be a valid date." };
  }
  return { ok: true, value: trimmed };
}

/**
 * Who may see these fields on a client profile (when the service supports them).
 * Assigned ES/TS and supervisors still need caseload / visibility checks at the API.
 */
export function canViewClientAuthorizedHoursFields(role: string | null | undefined): boolean {
  return (
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    isSupervisorTierRole(role) ||
    canViewClientProfiles(role) ||
    isReferralManagerRole(role)
  );
}

/**
 * Who may edit after intake on the client profile (same roles that can mutate client profile
 * data today). Assignment / supervisor visibility is enforced by assertClientProfileAccess.
 * Referral Queue / hospitality intake edits use canManageReferrals / canAccessHospitalityIntake.
 */
export function canEditClientAuthorizedHoursFields(role: string | null | undefined): boolean {
  return (
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    isSupervisorTierRole(role) ||
    isReferralManagerRole(role)
  );
}
