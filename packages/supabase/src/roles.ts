export const STAFF_ROLES = [
  "es",
  "transition_specialist",
  "supervisor",
  "accountant",
  "admin",
  "counselor",
  "gvra_supervisor",
  "super_admin",
  "hr",
  "hospitality_specialist",
  "wrt_admin",
  "instructor",
  "transition_director",
  "vocational_director",
] as const;

export const CLIENT_ROLES = ["client", "support"] as const;

/**
 * Roles assignable from portal pickers (org Admin or Super Admin).
 * Does not include `admin` / `super_admin` (Super Admin only) or retired `hr`
 * (`hr` remains in STAFF_ROLES / DB enum for legacy accounts).
 */
export const ASSIGNABLE_STAFF_ROLES = [
  "es",
  "transition_specialist",
  "supervisor",
  "accountant",
  "counselor",
  "hospitality_specialist",
  "transition_director",
  "vocational_director",
] as const;

/** Only Super Admin may assign these. Org Admin must never grant them. */
export const SUPER_ADMIN_ONLY_ASSIGNABLE_ROLES = ["admin", "super_admin"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];
export type ProfileRole = StaffRole | ClientRole;
export type AssignableStaffRole = (typeof ASSIGNABLE_STAFF_ROLES)[number];
export type SuperAdminOnlyAssignableRole = (typeof SUPER_ADMIN_ONLY_ASSIGNABLE_ROLES)[number];

export type PortalTier = "super_admin" | "admin" | "supervisor";

export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isStaffRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return (STAFF_ROLES as readonly string[]).includes(r);
}

export function isClientRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return (CLIENT_ROLES as readonly string[]).includes(r);
}

export function isSupportRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "support";
}

/** Employment Specialist field access. */
export function isEsRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "es";
}

export function isTransitionSpecialistRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "transition_specialist";
}

/** ES or Transition Specialist — shared caseload / messages / time shell. */
export function isFieldSpecialistRole(role: string | null | undefined): boolean {
  return isEsRole(role) || isTransitionSpecialistRole(role);
}

/** Pre-ETS-only field role (Transition Instructor / legacy instructor). */
export function isPreEtsOnlyFieldRole(role: string | null | undefined): boolean {
  return isInstructorRole(role);
}

export function isWrtAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "wrt_admin";
}

export function isCounselorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "counselor";
}

export function isGvraSupervisorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "gvra_supervisor";
}

/** External GVRA partner roles — not Joshua Tree team members. */
export function isGvraPartnerRole(role: string | null | undefined): boolean {
  return isCounselorRole(role) || isGvraSupervisorRole(role);
}

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "super_admin";
}

export function isAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "admin";
}

export function isSupervisorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "supervisor";
}

export function isHrRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "hr";
}

export function isAccountantRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "accountant";
}

export function isHospitalitySpecialistRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "hospitality_specialist";
}

export function isInstructorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "instructor";
}

export function isTransitionDirectorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "transition_director";
}

export function isVocationalDirectorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "vocational_director";
}

/** Director of Transition Services or Director of Development & Vocational Services. */
export function isDirectorRole(role: string | null | undefined): boolean {
  return isTransitionDirectorRole(role) || isVocationalDirectorRole(role);
}

/**
 * Staff who may view scoped casework but must not mutate it.
 * Enforced in middleware (non-GET), portal mutation helpers, and RLS write policies.
 */
export function isReadOnlyStaffRole(role: string | null | undefined): boolean {
  return isDirectorRole(role);
}

export function canEditOwnStaffProfile(role: string | null | undefined): boolean {
  return isStaffRole(role) && !isGvraPartnerRole(role);
}

/** View client names and profiles without caseload write access. */
export function canViewClientProfiles(role: string | null | undefined): boolean {
  return (
    isAdminTierRole(role) ||
    isHrRole(role) ||
    isAccountantRole(role) ||
    isHospitalitySpecialistRole(role) ||
    isDirectorRole(role)
  );
}

/** Internal staff notes — never clients, supports, or counselors. */
export function canViewStaffOnlyClientNotes(role: string | null | undefined): boolean {
  return (
    isAdminTierRole(role) ||
    isHrRole(role) ||
    isHospitalitySpecialistRole(role) ||
    isSupervisorRole(role) ||
    isFieldSpecialistRole(role) ||
    isDirectorRole(role)
  );
}

/** Referral disability/history on client profile — same visibility as internal staff notes. */
export function canViewStaffOnlyDisabilityHistory(role: string | null | undefined): boolean {
  return canViewStaffOnlyClientNotes(role);
}

/** Casework team may add or update disability/history when it was missing from the referral. */
export function canEditStaffOnlyDisabilityHistory(role: string | null | undefined): boolean {
  if (isReadOnlyStaffRole(role)) return false;
  return canViewStaffOnlyDisabilityHistory(role);
}

/**
 * Intake → service-start ops (Referral Queue / Intake Calls / Start Client).
 * HR Director inherits Hospitality intake work; Admins can execute and oversee.
 * Weekly/partner check-ins are separate — see canLogHospitalityCheckIns.
 */
export function canExecuteHospitalityIntakeOps(role: string | null | undefined): boolean {
  return isHospitalitySpecialistRole(role) || isHrRole(role) || isAdminTierRole(role);
}

export function canWriteStaffOnlyClientNotes(role: string | null | undefined): boolean {
  if (isReadOnlyStaffRole(role)) return false;
  return canExecuteHospitalityIntakeOps(role) || isSupervisorRole(role);
}

/** Weekly client / partner check-in logging (not HR — intake-only for HR). */
export function canLogHospitalityCheckIns(role: string | null | undefined): boolean {
  return isHospitalitySpecialistRole(role) || isAdminTierRole(role);
}

/** Assign / change ES or Transition Specialist on a client (intake + Regional Supervisor). */
export function canAssignClientEs(role: string | null | undefined): boolean {
  if (isReadOnlyStaffRole(role)) return false;
  return canExecuteHospitalityIntakeOps(role) || isSupervisorRole(role);
}

/** Edit/reschedule hospitality intake appointment on a client profile. */
export function canEditClientIntakeAppointment(role: string | null | undefined): boolean {
  return (
    canExecuteHospitalityIntakeOps(role) ||
    isSupervisorRole(role) ||
    isFieldSpecialistRole(role)
  );
}

/** View hospitality dashboard / weekly client and monthly partner check-ins (read). */
export function canViewHospitalityWorkspace(role: string | null | undefined): boolean {
  return isHospitalitySpecialistRole(role) || isAdminTierRole(role);
}

/** Formal report submissions oversight (Admin / Super Admin / HR) on any client profile. */
export function canOverseeFormalReportSubmissions(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isHrRole(role);
}

/** Joshua Tree Service Group teammates shown in Team Directory / celebrations. */
export const TEAM_DIRECTORY_ROLES = [
  "super_admin",
  "admin",
  "hr",
  "accountant",
  "supervisor",
  "transition_specialist",
  "es",
  "instructor",
  "transition_director",
  "vocational_director",
] as const;

export type TeamDirectoryRole = (typeof TEAM_DIRECTORY_ROLES)[number];

export function isTeamDirectoryMemberRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return (TEAM_DIRECTORY_ROLES as readonly string[]).includes(r);
}

/** Admin tier or legacy HR may edit team directory celebration fields / Admin titles. */
export function canManageTeamDirectory(role: string | null | undefined): boolean {
  return isAdminTierRole(role) || isHrRole(role);
}

export function isAssignableStaffRole(
  role: string | null | undefined
): role is AssignableStaffRole {
  const r = normalizeRole(role);
  return (ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(r);
}

export function isSuperAdminOnlyAssignableRole(
  role: string | null | undefined
): role is SuperAdminOnlyAssignableRole {
  const r = normalizeRole(role);
  return (SUPER_ADMIN_ONLY_ASSIGNABLE_ROLES as readonly string[]).includes(r);
}

/**
 * Whether `actorRole` may assign `targetRole` on create/update.
 * Only Super Admin may grant Admin or Super Admin.
 */
export function canActorAssignStaffRole(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined
): boolean {
  if (isSuperAdminOnlyAssignableRole(targetRole)) {
    return isSuperAdminRole(actorRole);
  }
  if (!isAssignableStaffRole(targetRole)) {
    return false;
  }
  return isSuperAdminRole(actorRole) || isAdminRole(actorRole);
}

/** Super admin or org admin. */
export function isAdminTierRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin";
}

/** Supervisor dashboard and log export scope. */
export function isSupervisorTierRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "super_admin" || r === "admin" || r === "supervisor";
}

export function isKnownRole(role: string | null | undefined): boolean {
  return isStaffRole(role) || isClientRole(role);
}

/** Formal reporting (Joshua Tree Reports) — field specialists, supervisors, and admin tier. */
export function canAccessFormalReporting(role: string | null | undefined): boolean {
  return isFieldSpecialistRole(role) || isSupervisorRole(role) || isAdminTierRole(role);
}

export function staffHomePath(role: string | null | undefined): string {
  const r = normalizeRole(role);
  if (r === "counselor") return "/dashboard/counselor";
  if (r === "gvra_supervisor") return "/dashboard/gvra-supervisor";
  if (r === "super_admin") return "/dashboard/super-admin";
  if (r === "admin") return "/dashboard/admin";
  if (r === "supervisor") return "/dashboard/supervisor";
  if (r === "accountant") return "/dashboard/intake-billing";
  if (r === "hr") return "/dashboard/hr";
  if (r === "hospitality_specialist") return "/dashboard/hospitality";
  // Legacy `wrt_admin` accounts route to Clients (role no longer assignable from UI).
  if (r === "wrt_admin") return "/dashboard/clients";
  if (r === "instructor") return "/dashboard/pre-ets";
  if (r === "transition_director" || r === "vocational_director") return "/dashboard/director";
  return "/dashboard/clients";
}

export function portalTierForRole(role: string | null | undefined): PortalTier | null {
  const r = normalizeRole(role);
  if (r === "super_admin") return "super_admin";
  if (r === "admin") return "admin";
  if (r === "supervisor") return "supervisor";
  return null;
}

export function roleDisplayName(role: string | null | undefined): string {
  const labels: Record<string, string> = {
    super_admin: "Super Admin",
    admin: "Admin",
    supervisor: "Regional Supervisor",
    es: "Employment Specialist",
    transition_specialist: "Transition Specialist",
    counselor: "Counselor",
    gvra_supervisor: "GVRA Supervisor",
    client: "Client",
    support: "Natural Support",
    accountant: "Accounts Specialist",
    hr: "HR Director",
    hospitality_specialist: "Hospitality Specialist",
    wrt_admin: "WRT Admin",
    instructor: "Transition Instructor",
    transition_director: "Director of Transition Services",
    vocational_director: "Director of Development & Vocational Services",
  };
  const key = normalizeRole(role);
  return labels[key] ?? key;
}

/** Directory position: custom job_title when set, else role display name. */
export function directoryPositionLabel(opts: {
  role: string | null | undefined;
  jobTitle?: string | null;
}): string {
  const title = (opts.jobTitle ?? "").trim();
  if (title) return title;
  return roleDisplayName(opts.role);
}

export const PREVIEWABLE_ROLES = [
  ...STAFF_ROLES,
  ...CLIENT_ROLES,
] as const;
