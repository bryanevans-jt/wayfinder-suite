import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import {
  canViewTeamCalendarStaff,
  listTeamCalendarVisibleStaffUserIds,
} from "./team-calendar-visibility";

export type RendezvousAccess = {
  featureEnabled: boolean;
  openToAll: boolean;
  /** True only when the caller may see that Rendezvous exists. */
  canAccessApp: boolean;
  role: string | null;
  userId: string | null;
};

export type RendezvousFeatureFlags = {
  featureEnabled: boolean;
  openToAll: boolean;
};

export async function loadRendezvousFeatureFlags(
  admin: SupabaseClient
): Promise<RendezvousFeatureFlags> {
  const { data, error } = await admin
    .from("admin_config")
    .select("rendezvous_enabled, rendezvous_open_to_all")
    .limit(1)
    .maybeSingle();
  if (error) {
    // Older DBs may lack the open_to_all column briefly.
    if (error.message.includes("rendezvous_open_to_all")) {
      const fallback = await admin
        .from("admin_config")
        .select("rendezvous_enabled")
        .limit(1)
        .maybeSingle();
      if (fallback.error) {
        throw new Error(`admin_config read failed: ${fallback.error.message}`);
      }
      return {
        featureEnabled: fallback.data?.rendezvous_enabled === true,
        openToAll: false,
      };
    }
    throw new Error(`admin_config read failed: ${error.message}`);
  }
  return {
    featureEnabled: data?.rendezvous_enabled === true,
    openToAll: data?.rendezvous_open_to_all === true,
  };
}

export async function loadRendezvousFeatureEnabled(
  admin: SupabaseClient
): Promise<boolean> {
  const flags = await loadRendezvousFeatureFlags(admin);
  return flags.featureEnabled;
}

export function canAccessRendezvousStaffApp(opts: {
  featureEnabled: boolean;
  openToAll?: boolean;
  role: string | null | undefined;
}): boolean {
  if (!opts.featureEnabled) return false;
  if (isSuperAdminRole(opts.role)) return true;
  if (!opts.openToAll) return false;
  return (
    isFieldSpecialistRole(opts.role) ||
    isSupervisorRole(opts.role) ||
    isAdminTierRole(opts.role)
  );
}

export async function resolveRendezvousAccess(
  admin: SupabaseClient,
  opts: { userId: string | null; role: string | null }
): Promise<RendezvousAccess> {
  const flags = await loadRendezvousFeatureFlags(admin);
  return {
    featureEnabled: flags.featureEnabled,
    openToAll: flags.openToAll,
    canAccessApp: canAccessRendezvousStaffApp({
      featureEnabled: flags.featureEnabled,
      openToAll: flags.openToAll,
      role: opts.role,
    }),
    role: opts.role,
    userId: opts.userId,
  };
}

/**
 * Who may view bookings for a staff member on Team Calendar.
 * Admin / super_admin: ES + Transition Specialist + Supervisor calendars.
 * Supervisor: self + supervisor_es_assignments reports (ES or TS).
 * Everyone else: self only.
 */
export async function canViewStaffBookings(
  admin: SupabaseClient,
  viewer: { userId: string; role: string | null },
  targetStaffUserId: string
): Promise<boolean> {
  return canViewTeamCalendarStaff(admin, viewer, targetStaffUserId);
}

/**
 * Staff user IDs the viewer may include on the team calendar.
 * Always an explicit list (admins get active ES/TS/supervisor IDs, not unbounded "all").
 */
export async function listVisibleStaffUserIds(
  admin: SupabaseClient,
  viewer: { userId: string; role: string | null }
): Promise<string[]> {
  const visibility = await listTeamCalendarVisibleStaffUserIds(admin, viewer);
  return visibility.staffUserIds;
}

/** Public booking pages require the org flag AND an explicitly enabled schedule. */
export function isPublicBookingAllowed(opts: {
  featureEnabled: boolean;
  scheduleEnabled: boolean;
}): boolean {
  return opts.featureEnabled && opts.scheduleEnabled;
}
