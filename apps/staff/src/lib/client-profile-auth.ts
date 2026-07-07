import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  respondWithAccessOrLoggedError,
  respondWithLoggedError,
  resolveErrorActor,
  USER_FACING_AUTH_REQUIRED,
  USER_FACING_FORBIDDEN,
  USER_FACING_NOT_FOUND,
} from "@wayfinder/supabase/error-log";
import { getAppSession, assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import {
  isAdminTierRole,
  isEsRole,
  isSupervisorTierRole,
} from "@wayfinder/supabase/roles";
import { createServerClient } from "@wayfinder/supabase";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

export class ClientProfileAuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function clientVisibleToSupervisor(clientId: string): Promise<boolean> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("client_visible_to_auth_user", {
    p_client_id: clientId,
  });
  if (error) {
    return false;
  }
  return Boolean(data);
}

export async function assertClientProfileAccess(clientId: string, forMutation = false) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }

  const session = await getAppSession();
  if (!session) {
    throw new ClientProfileAuthError("Unauthorized", 401);
  }

  const role = session.effectiveRole ?? "";
  const userId = session.effectiveUserId;

  let allowed = false;
  if (isEsRole(role)) {
    allowed = await esIsAssignedToClient(userId, clientId);
  } else if (isSupervisorTierRole(role)) {
    allowed = await esIsAssignedToClient(userId, clientId);
    if (!allowed) {
      allowed = await clientVisibleToSupervisor(clientId);
    }
  } else if (isAdminTierRole(role)) {
    allowed = true;
  }

  if (!allowed) {
    throw new ClientProfileAuthError("Forbidden", 403);
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch {
    throw new ClientProfileAuthError("Server configuration error", 503);
  }

  return {
    session,
    admin,
    readOnly: session.isPreviewing,
    role,
  };
}

export async function jsonClientProfileError(error: unknown, route = "api/clients/profile") {
  if (error instanceof ClientProfileAuthError) {
    return respondWithAccessOrLoggedError("staff", route, error);
  }
  return respondWithLoggedError("staff", route, error);
}
