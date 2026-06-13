import type { SupabaseClient } from "@supabase/supabase-js";

/** Links a clients row to the signed-in auth user when matched by contact email. */
export async function linkClientAuthUserByEmail(
  admin: SupabaseClient,
  authUserId: string,
  email: string | null | undefined
): Promise<string | null> {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const { data: rows, error } = await admin
    .from("clients")
    .select("id, user_id, profile_id, contact_email")
    .ilike("contact_email", normalized)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error || !rows?.length) {
    return null;
  }

  const row = rows[0]!;
  const clientId = row.id as string;
  const linkedId = (row.user_id as string | null) ?? (row.profile_id as string | null);

  if (linkedId === authUserId) {
    return clientId;
  }

  const { error: updateErr } = await admin
    .from("clients")
    .update({
      user_id: authUserId,
      profile_id: authUserId,
    })
    .eq("id", clientId);

  if (updateErr) {
    return linkedId ? clientId : null;
  }

  return clientId;
}

/** Resolve auth.users.id from a login email (admin API). */
export async function resolveAuthUserIdByEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    return null;
  }

  const match = (data.users ?? []).find(
    (user) => (user.email ?? "").trim().toLowerCase() === normalized
  );
  return match?.id ?? null;
}

export async function ensureClientAuthProfile(
  admin: SupabaseClient,
  authUserId: string,
  email: string | null | undefined
): Promise<void> {
  await linkClientAuthUserByEmail(admin, authUserId, email);

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  if (profile?.role === "client") {
    return;
  }

  await admin
    .from("profiles")
    .update({ role: "client", is_active: true })
    .eq("id", authUserId);
}
