import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  applyMidnightSplitIfNeeded,
  canUseStaffClock,
  listAttentionShifts,
  listRecentShifts,
  listShiftsForDate,
  localDateStringInTz,
  getOpenShift,
  sumShiftMinutes,
  type StaffClockShiftRow,
} from "@wayfinder/supabase/staff-time-clock";
import { isAdminTierRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { NextResponse } from "next/server";

export class StaffClockAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireStaffClockSession(forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const session = await getAppSession();
  if (!session) {
    throw new StaffClockAccessError("Unauthorized", 401);
  }
  const role = session.effectiveRole ?? "";
  if (!canUseStaffClock(role)) {
    throw new StaffClockAccessError("Forbidden", 403);
  }
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new StaffClockAccessError("Server configuration error", 503);
  }
  return { session, admin, role, userId: session.effectiveUserId };
}

export async function resolveClockTargetUserId(
  admin: ReturnType<typeof createServiceRoleClient>,
  actor: { userId: string; role: string },
  requestedUserId: string | null
): Promise<string> {
  const target = requestedUserId?.trim() || actor.userId;
  if (target === actor.userId) {
    return target;
  }
  if (isAdminTierRole(actor.role)) {
    return target;
  }
  if (isSupervisorRole(actor.role)) {
    const { supervisorCanAccessEs } = await import("@/lib/supervisor-client-scope");
    const allowed = await supervisorCanAccessEs(admin, actor.userId, target);
    if (allowed) {
      return target;
    }
  }
  throw new StaffClockAccessError("Forbidden", 403);
}

export async function jsonStaffClockError(error: unknown, route: string) {
  if (error instanceof StaffClockAccessError) {
    return respondWithAccessOrLoggedError("staff", route, error);
  }
  return respondWithLoggedError("staff", route, error);
}

export async function buildClockStatusPayload(
  admin: ReturnType<typeof createServiceRoleClient>,
  staffUserId: string
) {
  await applyMidnightSplitIfNeeded(admin, staffUserId);
  const today = localDateStringInTz();
  const [open, todayShifts, attention, recent] = await Promise.all([
    getOpenShift(admin, staffUserId),
    listShiftsForDate(admin, staffUserId, today),
    listAttentionShifts(admin, staffUserId),
    listRecentShifts(admin, staffUserId, 30),
  ]);

  return {
    timezone: "America/New_York",
    today,
    open: open as StaffClockShiftRow | null,
    todayMinutes: sumShiftMinutes(todayShifts),
    todayShifts,
    attentionShifts: attention,
    recentShifts: recent,
    stillWorkingPromptPending: Boolean(
      open?.still_working_prompted_at && !open?.still_working_ack_at
    ),
  };
}

export function staffClockOk(body: unknown) {
  return NextResponse.json(body);
}
