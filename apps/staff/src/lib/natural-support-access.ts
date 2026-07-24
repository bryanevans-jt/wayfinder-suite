import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";
import { clientInSupervisorScope, loadSupervisorScope } from "@/lib/supervisor-client-scope";

export class NaturalSupportAccessError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** ES, supervisor (scoped), admin, and super_admin may invite Natural Support for a client. */
export async function assertNaturalSupportClientAccess(
  clientId: string,
  forMutation = false
) {
  if (forMutation) {
    await assertNotPreviewMutation();
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new NaturalSupportAccessError("Unauthorized", 401);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    throw new NaturalSupportAccessError("Account inactive", 403);
  }

  const role = profile.role as string;

  if (isAdminTierRole(role)) {
    return { supabase, user, role };
  }

  if (isEsRole(role)) {
    const assigned = await esIsAssignedToClient(user.id, clientId);
    if (!assigned) {
      throw new NaturalSupportAccessError("Client not assigned to you", 403);
    }
    return { supabase, user, role };
  }

  if (isSupervisorRole(role)) {
    let admin;
    try {
      admin = createServiceRoleClient();
    } catch {
      throw new NaturalSupportAccessError("Server configuration error", 503);
    }
    const scope = await loadSupervisorScope(admin, user.id);
    const allowed = await clientInSupervisorScope(admin, scope, clientId);
    if (!allowed) {
      throw new NaturalSupportAccessError("Client not in your scope", 403);
    }
    return { supabase, user, role };
  }

  throw new NaturalSupportAccessError("Forbidden", 403);
}

export function requireServiceRoleAdmin() {
  try {
    return createServiceRoleClient();
  } catch {
    throw new NaturalSupportAccessError(
      "Missing SUPABASE_SERVICE_ROLE_KEY on the staff app server",
      503
    );
  }
}
