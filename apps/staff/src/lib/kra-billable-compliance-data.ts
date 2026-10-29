import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { loadKraBillableComplianceRollup } from "@wayfinder/supabase/kra-billable-compliance";
import { loadClientDisplayNameById } from "@/lib/client-display-names";
import { loadStaffNameById } from "@/lib/staff-names";

export async function loadOrgKraBillableComplianceRollup(monthKey: string) {
  const admin = createServiceRoleClient();
  const { data: staffProfiles } = await admin
    .from("profiles")
    .select("id")
    .in("role", ["es", "transition_specialist"])
    .neq("is_active", false);
  const staffIds = (staffProfiles ?? []).map((p) => p.id as string);
  const nameByStaffId = await loadStaffNameById(admin, staffIds, "Team member");

  const { data: links } = await admin.from("es_client_assignments").select("client_id");
  const clientIds = [...new Set((links ?? []).map((l) => l.client_id as string))];
  const nameByClientId = await loadClientDisplayNameById(admin, clientIds);

  return loadKraBillableComplianceRollup(admin, monthKey, nameByStaffId, nameByClientId);
}
