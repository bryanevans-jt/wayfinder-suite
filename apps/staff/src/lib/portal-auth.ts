import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithLoggedError,
  USER_FACING_ACCOUNT_INACTIVE,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_SYSTEM_ERROR,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isSuperAdminRole,
  isSupervisorTierRole,
  type PortalTier,
} from "@wayfinder/supabase/roles";

export class PortalAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function tierAllowed(role: string | null | undefined, minTier: PortalTier): boolean {
  if (minTier === "super_admin") return isSuperAdminRole(role);
  if (minTier === "admin") return isAdminTierRole(role);
  return isSupervisorTierRole(role);
}

/** Verifies session role and returns a service-role client for portal mutations. */
export async function assertPortalSession(minTier: PortalTier) {
  const session = await getAppSession();
  if (!session) {
    throw new PortalAuthError("Unauthorized", 401);
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  if (!profile?.is_active) {
    throw new PortalAuthError("Account inactive", 403);
  }

  const role = session.isPreviewing ? session.effectiveRole : profile.role;

  if (!tierAllowed(role, minTier)) {
    throw new PortalAuthError("Forbidden", 403);
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new PortalAuthError(
      "Missing SUPABASE_SERVICE_ROLE_KEY on the staff app server",
      503
    );
  }

  return {
    supabase,
    admin,
    user: { id: session.effectiveUserId },
    role: role as string,
    isSuperAdmin: isSuperAdminRole(profile.role),
    canEditLogs: isSuperAdminRole(profile.role) && !session.isPreviewing,
  };
}

/** Portal write operations — blocks super_admin preview impersonation. */
export async function assertPortalMutation(minTier: PortalTier) {
  await assertNotPreviewMutation();
  return assertPortalSession(minTier);
}

function portalAuthUserMessage(error: PortalAuthError): string {
  if (error.status === 401) return USER_FACING_AUTH_REQUIRED;
  if (error.message === "Account inactive") return USER_FACING_ACCOUNT_INACTIVE;
  if (error.status === 403) return USER_FACING_FORBIDDEN;
  if (error.status === 400 || error.status === 404) return error.message;
  if (error.status === 503) return USER_FACING_SYSTEM_ERROR;
  return USER_FACING_SYSTEM_ERROR;
}

export async function jsonPortalError(error: unknown, route = "portal/api") {
  if (error instanceof PortalAuthError) {
    if (error.status >= 500) {
      return respondWithLoggedError("staff", route, error, {}, error.status);
    }
    return Response.json({ error: portalAuthUserMessage(error) }, { status: error.status });
  }
  return respondWithLoggedError("staff", route, error, {}, 500);
}
