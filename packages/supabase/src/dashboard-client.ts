import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupportRole } from "./roles";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DashboardClientContext = {
  clientId: string;
  readOnly: boolean;
  userId: string;
};

export async function resolveDashboardClient(
  supabase: SupabaseClient,
  userId: string,
  role: string | null | undefined,
  selectedClientId?: string
): Promise<DashboardClientContext | null> {
  const readOnly = isSupportRole(role);

  if (readOnly) {
    const { data: assignments } = await supabase
      .from("support_client_assignments")
      .select("client_id")
      .eq("support_user_id", userId);

    const allowed = (assignments ?? []).map((a) => a.client_id as string);
    if (allowed.length === 0) {
      return null;
    }

    let pickId = allowed[0]!;
    if (selectedClientId && UUID_RE.test(selectedClientId)) {
      const match = allowed.find((id) => id === selectedClientId);
      if (match) {
        pickId = match;
      }
    }

    return { clientId: pickId, readOnly: true, userId };
  }

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (clientRow?.id) {
    return { clientId: clientRow.id, readOnly: false, userId };
  }

  const { data: byProfile } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (byProfile?.id) {
    return { clientId: byProfile.id, readOnly: false, userId };
  }

  return null;
}
