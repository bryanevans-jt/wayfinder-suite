import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { loadSupervisorScope } from "@wayfinder/supabase/supervisor-client-scope";

/**
 * Rollout mode. Until broader launch, only Wayfinder super admins may discover
 * or use authenticated Rendezvous surfaces — even if the org flag is on.
 */
export const RENDEZVOUS_STAFF_ACCESS_MODE = "super_admin_only" as const;

export type RendezvousAccess = {
  featureEnabled: boolean;
  /** True only when the caller may see that Rendezvous exists. */
  canAccessApp: boolean;
  role: string | null;
  userId: string | null;
};

export async function loadRendezvousFeatureEnabled(
  admin: SupabaseClient
): Promise<boolean> {
  const { data } = await admin
    .from("admin_config")
    .select("rendezvous_enabled")
    .limit(1)
    .maybeSingle();
  return data?.rendezvous_enabled === true;
}

export function canAccessRendezvousStaffApp(opts: {
  featureEnabled: boolean;
  role: string | null | undefined;
}): boolean {
  if (!opts.featureEnabled) return false;
  if (RENDEZVOUS_STAFF_ACCESS_MODE === "super_admin_only") {
    return isSuperAdminRole(opts.role);
  }
  return isFieldSpecialistRole(opts.role) || isSupervisorRole(opts.role) || isAdminTierRole(opts.role);
}

export async function resolveRendezvousAccess(
  admin: SupabaseClient,
  opts: { userId: string | null; role: string | null }
): Promise<RendezvousAccess> {
  const featureEnabled = await loadRendezvousFeatureEnabled(admin);
  return {
    featureEnabled,
    canAccessApp: canAccessRendezvousStaffApp({
      featureEnabled,
      role: opts.role,
    }),
    role: opts.role,
    userId: opts.userId,
  };
}

/**
 * Who may view bookings for a staff member once Rendezvous is rolled out.
 * Super admin / admin: everyone. Supervisor: self + direct reports. Specialist: self.
 * During super_admin_only mode the staff app gate still blocks non–super-admins.
 */
export async function canViewStaffBookings(
  admin: SupabaseClient,
  viewer: { userId: string; role: string | null },
  targetStaffUserId: string
): Promise<boolean> {
  if (isAdminTierRole(viewer.role)) return true;
  if (viewer.userId === targetStaffUserId) return true;
  if (isSupervisorRole(viewer.role)) {
    const scope = await loadSupervisorScope(admin, viewer.userId);
    return (
      targetStaffUserId === scope.supervisorUserId ||
      scope.esUserIds.includes(targetStaffUserId)
    );
  }
  return false;
}

/** Staff user IDs the viewer may include on the team calendar. */
export async function listVisibleStaffUserIds(
  admin: SupabaseClient,
  viewer: { userId: string; role: string | null }
): Promise<string[] | "all"> {
  if (isAdminTierRole(viewer.role)) return "all";
  if (isSupervisorRole(viewer.role)) {
    const scope = await loadSupervisorScope(admin, viewer.userId);
    return Array.from(new Set([viewer.userId, ...scope.esUserIds]));
  }
  return [viewer.userId];
}

/** Public booking pages require the org flag AND an explicitly enabled schedule. */
export function isPublicBookingAllowed(opts: {
  featureEnabled: boolean;
  scheduleEnabled: boolean;
}): boolean {
  return opts.featureEnabled && opts.scheduleEnabled;
}
