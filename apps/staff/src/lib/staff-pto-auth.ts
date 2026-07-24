import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isPtoPreviewUnlocked } from "@wayfinder/supabase/staff-pto-shared";
import { NextResponse } from "next/server";

export class StaffPtoAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Admin/super_admin only while PTO is in preview. */
export async function requireStaffPtoSession(forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const session = await getAppSession();
  if (!session) {
    throw new StaffPtoAccessError("Unauthorized", 401);
  }
  const role = session.effectiveRole ?? "";
  if (!isPtoPreviewUnlocked(role)) {
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
  };
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
