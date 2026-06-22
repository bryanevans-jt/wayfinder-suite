export const STAFF_ROLES = [
  "es",
  "supervisor",
  "accountant",
  "admin",
  "counselor",
  "super_admin",
] as const;

export const CLIENT_ROLES = ["client", "support"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];
export type ClientRole = (typeof CLIENT_ROLES)[number];
export type ProfileRole = StaffRole | ClientRole;

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

export function isEsRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === "es";
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

export function staffHomePath(role: string | null | undefined): string {
  const r = normalizeRole(role);
  if (r === "counselor") return "/dashboard/counselor";
  if (r === "super_admin") return "/dashboard/super-admin";
  if (r === "admin") return "/dashboard/admin";
  if (r === "supervisor") return "/dashboard/supervisor";
  if (r === "accountant") return "/dashboard/timesheet";
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
    super_admin: "Super admin",
    admin: "Admin",
    supervisor: "Supervisor",
    es: "Employment Specialist",
    counselor: "Counselor",
    client: "Client",
    support: "Natural support",
    accountant: "Accountant",
  };
  const key = normalizeRole(role);
  return labels[key] ?? key;
}

export const PREVIEWABLE_ROLES = [
  ...STAFF_ROLES,
  ...CLIENT_ROLES,
] as const;
