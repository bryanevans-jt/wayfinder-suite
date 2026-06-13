import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { assertNotPreviewMutation } from "@wayfinder/supabase/preview-server";
import { isAdminTierRole, isEsRole, isSupervisorRole } from "@wayfinder/supabase/roles";
import { esIsAssignedToClient } from "@/lib/es-caseload-data";

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
    const { data: supLinks } = await supabase
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", user.id);

    const esIds = (supLinks ?? []).map((l) => l.es_user_id as string);
    if (esIds.length === 0) {
      throw new NaturalSupportAccessError("Forbidden", 403);
    }

    const [{ data: clientRow }, { data: esLink }] = await Promise.all([
      supabase.from("clients").select("id, office_id").eq("id", clientId).maybeSingle(),
      supabase
        .from("es_client_assignments")
        .select("client_id")
        .eq("client_id", clientId)
        .in("es_user_id", esIds)
        .limit(1)
        .maybeSingle(),
    ]);

    if (!clientRow) {
      throw new NaturalSupportAccessError("Client not found", 404);
    }

    if (esLink) {
      return { supabase, user, role };
    }

    const { data: officeLinks } = await supabase
      .from("staff_office_assignments")
      .select("office_id")
      .eq("user_id", user.id);

    const officeIds = new Set((officeLinks ?? []).map((l) => l.office_id as string));
    if (clientRow.office_id && officeIds.has(clientRow.office_id as string)) {
      return { supabase, user, role };
    }

    throw new NaturalSupportAccessError("Client outside your supervisor scope", 403);
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
