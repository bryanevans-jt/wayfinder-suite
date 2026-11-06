import { ClientFieldSpecialistContact } from "@/components/client-field-specialist-contact";
import { loadFieldSpecialistContactsByClientIds } from "@wayfinder/supabase/es-field-specialist-contact";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { createServerClient, isStaffRole, isSupportRole, resolveDashboardClient } from "@wayfinder/supabase";

type Props = {
  selectedClientId?: string;
  sessionUserId: string;
  sessionRole: string | null;
  /** Super Admin audit preview — do not load ES contact via service role. */
  isPreviewing?: boolean;
  /** When previewing, the staff member opening the preview (not the client). */
  actorRole?: string | null;
};

export async function ClientFieldSpecialistSection({
  selectedClientId,
  sessionUserId,
  sessionRole,
  isPreviewing,
  actorRole,
}: Props) {
  if (isPreviewing || (actorRole != null && isStaffRole(actorRole))) {
    return null;
  }

  const supabase = await createServerClient();
  let ctx: Awaited<ReturnType<typeof resolveDashboardClient>> = null;
  try {
    ctx = await resolveDashboardClient(supabase, sessionUserId, sessionRole, selectedClientId);
  } catch {
    ctx = null;
  }
  if (!ctx) {
    return null;
  }

  if (isSupportRole(sessionRole)) {
    return null;
  }

  try {
    const admin = createServiceRoleClient();
    const map = await loadFieldSpecialistContactsByClientIds(admin, [ctx.clientId]);
    const fs = map.get(ctx.clientId);
    if (!fs) {
      return null;
    }
    return <ClientFieldSpecialistContact fullName={fs.fullName} email={fs.email} />;
  } catch {
    return null;
  }
}
