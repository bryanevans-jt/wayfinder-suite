/**
 * Team Calendar visibility (server-side).
 *
 * Supervisor scope reuses the existing Wayfinder helper `loadSupervisorScope`:
 * - `public.supervisor_es_assignments` (supervisor_user_id → es_user_id;
 *   supervisee may be ES or Transition Specialist)
 * - plus office-shared Transition Specialists / Instructors in the supervisor's
 *   offices (same rules as other Wayfinder caseload surfaces)
 *
 * Rules:
 * - Admin / super_admin: every active ES, Transition Specialist, and Supervisor
 * - Supervisor: self + loadSupervisorScope staff (assignments + office-shared TS/instructors)
 * - Everyone else (ES/TS, …): self only
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminTierRole, isSupervisorRole, normalizeRole } from "@wayfinder/supabase/roles";
import { loadSupervisorScope } from "@wayfinder/supabase/supervisor-client-scope";

/** Roles whose calendars admins may browse on Team Calendar. */
export const TEAM_CALENDAR_ADMIN_VISIBLE_ROLES = [
  "es",
  "transition_specialist",
  "supervisor",
] as const;

export type TeamCalendarViewer = {
  userId: string;
  role: string | null;
};

export type TeamCalendarVisibilityMode = "admin_team" | "supervisor_reports" | "self";

export type TeamCalendarVisibility = {
  mode: TeamCalendarVisibilityMode;
  /** Explicit staff user IDs allowed on the calendar. Never empty when viewer has a userId. */
  staffUserIds: string[];
};

/** Pure rule helper for tests — no DB. */
export function resolveTeamCalendarVisibilityMode(
  role: string | null | undefined
): TeamCalendarVisibilityMode {
  if (isAdminTierRole(role)) return "admin_team";
  if (isSupervisorRole(role)) return "supervisor_reports";
  return "self";
}

export function isTeamCalendarAdminVisibleRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return (TEAM_CALENDAR_ADMIN_VISIBLE_ROLES as readonly string[]).includes(r);
}

/**
 * Staff user IDs a supervisor may see on Team Calendar — same as Wayfinder
 * `loadSupervisorScope.esUserIds` (assignments + office-shared TS/instructors).
 */
export async function loadSupervisorTeamCalendarStaffUserIds(
  admin: SupabaseClient,
  supervisorUserId: string
): Promise<string[]> {
  const scope = await loadSupervisorScope(admin, supervisorUserId);
  return scope.esUserIds;
}

/**
 * Active ES / Transition Specialist / Supervisor profile IDs for admin Team Calendar.
 */
export async function loadAdminTeamCalendarStaffUserIds(
  admin: SupabaseClient
): Promise<string[]> {
  const full = await admin
    .from("profiles")
    .select("id, role, is_active")
    .in("role", [...TEAM_CALENDAR_ADMIN_VISIBLE_ROLES]);
  const result =
    full.error?.message.includes("is_active")
      ? await admin
          .from("profiles")
          .select("id, role")
          .in("role", [...TEAM_CALENDAR_ADMIN_VISIBLE_ROLES])
      : full;
  if (result.error) {
    throw new Error(`profiles read failed: ${result.error.message}`);
  }
  return Array.from(
    new Set(
      (result.data ?? [])
        .filter((row) => {
          const active = (row as { is_active?: boolean | null }).is_active;
          if (active === false) return false;
          return isTeamCalendarAdminVisibleRole(row.role as string);
        })
        .map((row) => row.id as string)
        .filter(Boolean)
    )
  );
}

/**
 * Server-side Team Calendar visibility for the signed-in viewer.
 * Always returns an explicit ID list (no unbounded "all").
 */
export async function listTeamCalendarVisibleStaffUserIds(
  admin: SupabaseClient,
  viewer: TeamCalendarViewer
): Promise<TeamCalendarVisibility> {
  const mode = resolveTeamCalendarVisibilityMode(viewer.role);
  if (mode === "admin_team") {
    const teamIds = await loadAdminTeamCalendarStaffUserIds(admin);
    return {
      mode,
      staffUserIds: Array.from(new Set([viewer.userId, ...teamIds])),
    };
  }
  if (mode === "supervisor_reports") {
    const scoped = await loadSupervisorTeamCalendarStaffUserIds(admin, viewer.userId);
    return {
      mode,
      staffUserIds: Array.from(new Set([viewer.userId, ...scoped])),
    };
  }
  return { mode: "self", staffUserIds: [viewer.userId] };
}

/** Whether the viewer may see bookings for a specific staff user (calendar rules). */
export async function canViewTeamCalendarStaff(
  admin: SupabaseClient,
  viewer: TeamCalendarViewer,
  targetStaffUserId: string
): Promise<boolean> {
  if (!targetStaffUserId) return false;
  if (viewer.userId === targetStaffUserId) return true;
  const visibility = await listTeamCalendarVisibleStaffUserIds(admin, viewer);
  return visibility.staffUserIds.includes(targetStaffUserId);
}
