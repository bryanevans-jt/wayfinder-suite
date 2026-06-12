import type { SupabaseClient } from "@supabase/supabase-js";

/** Resolve the clients.id row for a signed-in auth user (user_id or legacy profile_id). */
export async function resolveAuthClientId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("clients")
    .select("id")
    .or(`user_id.eq.${authUserId},profile_id.eq.${authUserId}`)
    .maybeSingle();

  return data?.id ?? null;
}
