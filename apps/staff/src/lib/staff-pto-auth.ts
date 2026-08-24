import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  canApproveStaffPto,
  canManageStaffPtoSettings,
  canSupervisorAdvanceStaffPto,
  canUseStaffPto,
  canViewAllStaffPto,
  canViewDesignatedEsPto,
} from "@wayfinder/supabase/staff-pto-shared";
import { NextResponse } from "next/server";

export class StaffPtoAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireStaffPtoSession(forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const session = await getAppSession();
  if (!session) {
    throw new StaffPtoAccessError("Unauthorized", 401);
  }
  const role = session.effectiveRole ?? "";
  if (!canUseStaffPto(role)) {
    throw new StaffPtoAccessError("Forbidden", 403);
  }
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new StaffPtoAccessError("Server configuration error", 503);
  }
  return {
    session,
    admin,
    role,
    userId: session.effectiveUserId,
    actor: { userId: session.actorUserId, userRole: role },
    caps: {
      canApprove: canApproveStaffPto(role),
      canSupervisorAdvance: canSupervisorAdvanceStaffPto(role),
      canManageSettings: canManageStaffPtoSettings(role),
      canViewAll: canViewAllStaffPto(role),
      canViewDesignatedEs: canViewDesignatedEsPto(role),
    },
  };
}

/** Designated ES / Instructor user IDs for a supervisor (assignments only). */
export async function loadDesignatedEsUserIds(
  admin: ReturnType<typeof createServiceRoleClient>,
  supervisorUserId: string
): Promise<string[]> {
  const { data, error } = await admin
    .from("supervisor_es_assignments")
    .select("es_user_id")
    .eq("supervisor_user_id", supervisorUserId);
  if (error) {
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).map((r) => r.es_user_id as string))];
}

/** Whether this staff member has at least one assigned supervisor. */
export async function staffHasAssignedSupervisor(
  admin: ReturnType<typeof createServiceRoleClient>,
  staffUserId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("supervisor_es_assignments")
    .select("supervisor_user_id")
    .eq("es_user_id", staffUserId)
    .limit(1);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).length > 0;
}

export async function jsonStaffPtoError(error: unknown, route: string) {
  if (error instanceof StaffPtoAccessError) {
    return respondWithAccessOrLoggedError("staff", route, error);
  }
  return respondWithLoggedError("staff", route, error);
}

export function staffPtoOk(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}
