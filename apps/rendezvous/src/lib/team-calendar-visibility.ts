/**
 * Team Calendar visibility (server-side).
 *
 * Supervisor scope uses DIRECT REPORTS ONLY from
 * `public.supervisor_es_assignments` (supervisor_user_id → es_user_id;
 * supervisee may be ES or Transition Specialist). Office-shared
 * Transition Specialists / Instructors are intentionally NOT included
 * on Team Calendar (unlike Wayfinder caseload `loadSupervisorScope`).
 *
 * Rules:
 * - Admin / super_admin: every active ES, Transition Specialist, and Supervisor
 *   (admins' own calendars are never included for any viewer)
 * - Supervisor: self + direct reports from supervisor_es_assignments
 * - Everyone else (ES/TS, …): self only
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isAdminTierRole, isSupervisorRole, normalizeRole } from "@wayfinder/supabase/roles";

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
  /** Explicit staff user IDs allowed on the calendar (admins/super_admins never included). */
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

/** Admin / super_admin calendars are never shown on Team Calendar. */
export function isTeamCalendarExcludedRole(role: string | null | undefined): boolean {
  return isAdminTierRole(role);
}

/**
 * Staff user IDs a supervisor may see on Team Calendar — direct reports only
 * from `public.supervisor_es_assignments` (no office-shared TS/instructors).
 */
export async function loadSupervisorTeamCalendarStaffUserIds(
  admin: SupabaseClient,
  supervisorUserId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("supervisor_es_assignments")
    .select("es_user_id")
    .eq("supervisor_user_id", supervisorUserId);
  if (error) {
    throw new Error(`supervisor_es_assignments read failed: ${error.message}`);
  }
  return Array.from(
    new Set((data ?? []).map((row) => row.es_user_id as string).filter(Boolean))
  );
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
 * Drop any admin / super_admin IDs so those calendars never leave the server.
 */
export async function excludeAdminTierCalendars(
  admin: SupabaseClient,
  staffUserIds: string[]
): Promise<string[]> {
  const unique = Array.from(new Set(staffUserIds.filter(Boolean)));
  if (unique.length === 0) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, role")
    .in("id", unique);
  if (error) {
    throw new Error(`profiles role filter failed: ${error.message}`);
  }
  const allowed = new Set(
    (data ?? [])
      .filter((row) => !isTeamCalendarExcludedRole(row.role as string))
      .map((row) => row.id as string)
  );
  // Preserve caller order; drop unknown ids that failed the profile read.
  return unique.filter((id) => allowed.has(id));
}

/**
 * Server-side Team Calendar visibility for the signed-in viewer.
 * Always returns an explicit ID list (no unbounded "all").
 * Admin / super_admin calendars are never included — including the viewer's own.
 */
export async function listTeamCalendarVisibleStaffUserIds(
  admin: SupabaseClient,
  viewer: TeamCalendarViewer
): Promise<TeamCalendarVisibility> {
  const mode = resolveTeamCalendarVisibilityMode(viewer.role);
  let candidateIds: string[];
  if (mode === "admin_team") {
    // Do not add the admin viewer — their calendar is excluded for every viewer.
    candidateIds = await loadAdminTeamCalendarStaffUserIds(admin);
  } else if (mode === "supervisor_reports") {
    const scoped = await loadSupervisorTeamCalendarStaffUserIds(admin, viewer.userId);
    candidateIds = Array.from(new Set([viewer.userId, ...scoped]));
  } else {
    candidateIds = [viewer.userId];
  }

  const staffUserIds = await excludeAdminTierCalendars(admin, candidateIds);
  return { mode, staffUserIds };
}

/** Whether the viewer may see calendar data for a specific staff user. */
export async function canViewTeamCalendarStaff(
  admin: SupabaseClient,
  viewer: TeamCalendarViewer,
  targetStaffUserId: string
): Promise<boolean> {
  if (!targetStaffUserId) return false;
  const visibility = await listTeamCalendarVisibleStaffUserIds(admin, viewer);
  return visibility.staffUserIds.includes(targetStaffUserId);
}
