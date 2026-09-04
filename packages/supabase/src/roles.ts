export const STAFF_ROLES = [
  "es",
  "transition_specialist",
  "supervisor",
  "accountant",
  "admin",
  "counselor",
  "super_admin",
  "hr",
  "hospitality_specialist",
  "wrt_admin",
  "instructor",
] as const;

export const CLIENT_ROLES = ["client", "support"] as const;

/** Roles a super admin can assign from the Users settings screen. */
export const ASSIGNABLE_STAFF_ROLES = [
  "es",
  "transition_specialist",
  "supervisor",
  "accountant",
  "admin",
  "counselor",
  "hr",
  "hospitality_specialist",
  "wrt_admin",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];
export type ProfileRole = StaffRole | ClientRole;
export type AssignableStaffRole = (typeof ASSIGNABLE_STAFF_ROLES)[number];

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

export function isWrtAdminRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "wrt_admin";
}

export function isCounselorRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "counselor";
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

export function canEditOwnStaffProfile(role: string | null | undefined): boolean {
  return isStaffRole(role) && !isCounselorRole(role);
}

/** View client names and profiles without caseload write access. */
export function canViewClientProfiles(role: string | null | undefined): boolean {
  return (
    isAdminTierRole(role) ||
    isHrRole(role) ||
    isAccountantRole(role) ||
    isHospitalitySpecialistRole(role)
  );
}

/** Internal staff notes — never clients, supports, or counselors. */
export function canViewStaffOnlyClientNotes(role: string | null | undefined): boolean {
  return (
    isAdminTierRole(role) ||
    isHrRole(role) ||
    isHospitalitySpecialistRole(role) ||
    isSupervisorRole(role) ||
    isFieldSpecialistRole(role)
  );
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
  return canExecuteHospitalityIntakeOps(role) || isSupervisorRole(role);
}

/** Weekly client / partner check-in logging (not HR — intake-only for HR). */
export function canLogHospitalityCheckIns(role: string | null | undefined): boolean {
  return isHospitalitySpecialistRole(role) || isAdminTierRole(role);
}

/** Assign / change ES or Transition Specialist on a client (intake + Regional Supervisor). */
export function canAssignClientEs(role: string | null | undefined): boolean {
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

/** Super Admin or HR may edit team directory celebration fields / Admin titles. */
export function canManageTeamDirectory(role: string | null | undefined): boolean {
  return isSuperAdminRole(role) || isHrRole(role);
}

export function isAssignableStaffRole(
  role: string | null | undefined
): role is AssignableStaffRole {
  const r = normalizeRole(role);
  return (ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(r);
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
  if (r === "super_admin") return "/dashboard/super-admin";
  if (r === "admin") return "/dashboard/admin";
  if (r === "supervisor") return "/dashboard/supervisor";
  if (r === "accountant") return "/dashboard/intake-billing";
  if (r === "hr") return "/dashboard/hr";
  if (r === "hospitality_specialist") return "/dashboard/hospitality";
  if (r === "wrt_admin") return "/dashboard/wrt";
  if (r === "instructor" || r === "transition_specialist") return "/dashboard/pre-ets";
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
    client: "Client",
    support: "Natural Support",
    accountant: "Accounts Specialist",
    hr: "HR Director",
    hospitality_specialist: "Hospitality Specialist",
    wrt_admin: "WRT Admin",
    instructor: "Instructor",
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
