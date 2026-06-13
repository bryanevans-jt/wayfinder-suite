import type { SupabaseClient } from "@supabase/supabase-js";

/** Find clients.id for a signed-in auth user (matches user_id, profile_id, or contact email). */
export async function lookupClientIdForAuthUser(
  db: SupabaseClient,
  authUserId: string,
  email?: string | null
): Promise<string | null> {
  const { data: rpcId, error: rpcError } = await db.rpc("get_client_id_for_auth_user");
  if (!rpcError && rpcId) {
    return rpcId as string;
  }

  const { data: byUser } = await db
    .from("clients")
    .select("id")
    .eq("user_id", authUserId)
    .limit(1)
    .maybeSingle();

  if (byUser?.id) {
    return byUser.id as string;
  }

  const { data: byProfile } = await db
    .from("clients")
    .select("id")
    .eq("profile_id", authUserId)
    .limit(1)
    .maybeSingle();

  if (byProfile?.id) {
    return byProfile.id as string;
  }

  const { data: byLegacyId } = await db
    .from("clients")
    .select("id")
    .eq("id", authUserId)
    .limit(1)
    .maybeSingle();

  if (byLegacyId?.id) {
    return byLegacyId.id as string;
  }

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const { data: byEmail } = await db
      .from("clients")
      .select("id")
      .ilike("contact_email", normalizedEmail)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (byEmail?.id) {
      return byEmail.id as string;
    }
  }

  return null;
}

/** Resolve the clients.id row using the caller's RLS-scoped client. */
export async function resolveAuthClientId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string | null> {
  return lookupClientIdForAuthUser(supabase, authUserId);
}
