import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  WRT_DEMO_SANDBOX_EMAIL,
  canManageWrtCurriculum,
  canUseWrtFacilitation,
} from "@wayfinder/supabase/staff-wrt-shared";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

type ServiceAdmin = SupabaseClient;

export class WrtAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Admin / Super Admin — curriculum CRUD and seed. */
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

/** ES / TS / Supervisor / Admin / Super Admin — facilitation, sessions, print kit. */
export async function requireWrtFacilitationSession(forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const session = await getAppSession();
  if (!session) {
    throw new WrtAccessError("Unauthorized", 401);
  }
  const role = session.effectiveRole ?? "";
  if (!canUseWrtFacilitation(role)) {
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

/**
 * Blocks non-admin staff from using the WRT Demo Sandbox client (by stable contact_email).
 * Admins may use it for full portal demos; field roles use real clients only.
 */
export async function assertWrtDemoClientAllowedForRole(
  admin: ServiceAdmin,
  role: string,
  clientId: string | null | undefined
): Promise<void> {
  const id = clientId?.trim();
  if (!id || canManageWrtCurriculum(role)) return;
  const { data } = await admin
    .from("clients")
    .select("contact_email")
    .eq("id", id)
    .maybeSingle();
  if (data?.contact_email === WRT_DEMO_SANDBOX_EMAIL) {
    throw new WrtAccessError(
      "The WRT Demo Sandbox is only available to Admins and Super Admins.",
      403
    );
  }
}

export async function assertWrtDemoClientAllowedForRoleMany(
  admin: ServiceAdmin,
  role: string,
  clientIds: Array<string | null | undefined>
): Promise<void> {
  if (canManageWrtCurriculum(role)) return;
  const ids = [...new Set(clientIds.map((c) => c?.trim()).filter(Boolean))] as string[];
  if (ids.length === 0) return;
  const { data } = await admin.from("clients").select("id, contact_email").in("id", ids);
  const hit = (data ?? []).some((r) => r.contact_email === WRT_DEMO_SANDBOX_EMAIL);
  if (hit) {
    throw new WrtAccessError(
      "The WRT Demo Sandbox is only available to Admins and Super Admins.",
      403
    );
  }
}

export async function assertWrtDemoEnrollmentAllowedForRole(
  admin: ServiceAdmin,
  role: string,
  enrollmentId: string | null | undefined
): Promise<void> {
  const id = enrollmentId?.trim();
  if (!id) return;
  const { data } = await admin.from("wrt_enrollments").select("client_id").eq("id", id).maybeSingle();
  const cid = data?.client_id as string | undefined;
  if (cid) await assertWrtDemoClientAllowedForRole(admin, role, cid);
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
