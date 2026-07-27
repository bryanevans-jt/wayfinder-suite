import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { canManageWrtCurriculum } from "@wayfinder/supabase/staff-wrt-shared";
import { NextResponse } from "next/server";

export class WrtAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireWrtCurriculumSession(forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const session = await getAppSession();
  if (!session) {
    throw new WrtAccessError("Unauthorized", 401);
  }
  const role = session.effectiveRole ?? "";
  if (!canManageWrtCurriculum(role)) {
    throw new WrtAccessError("Forbidden", 403);
  }
  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new WrtAccessError("Server configuration error", 503);
  }
  return {
    session,
    admin,
    role,
    userId: session.effectiveUserId,
  };
}

export async function jsonWrtError(error: unknown, route: string) {
  if (error instanceof WrtAccessError) {
    return respondWithAccessOrLoggedError("staff", route, error);
  }
  return respondWithLoggedError("staff", route, error);
}

export function wrtOk(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, init);
}
