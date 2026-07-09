import type { SupabaseClient } from "@supabase/supabase-js";

/** Normalize a client name for duplicate detection across imports. */
export function normalizeClientNameKey(name: string): string {
  let trimmed = name.trim().replace(/\s+/g, " ");
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",").map((part) => part.trim());
    if (first && last) {
      trimmed = `${first} ${last}`;
    }
  }
  return trimmed.toLowerCase();
}

/**
 * Map normalized client name → client id for all existing clients
 * (roster rows, profile names, and linked auth users).
 */
export async function loadClientIdsByNormalizedName(
  admin: SupabaseClient
): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const { data: clients, error } = await admin
    .from("clients")
    .select("id, full_name, user_id, profile_id, contact_email");

  if (error) {
    throw new Error(error.message);
  }

  const profileIds = new Set<string>();

  for (const client of clients ?? []) {
    const clientId = client.id as string;
    const fullName = (client.full_name as string | null)?.trim();
    if (fullName) {
      const key = normalizeClientNameKey(fullName);
      if (key && !map.has(key)) {
        map.set(key, clientId);
      }
    }

    const authId =
      ((client.user_id as string | null) ?? (client.profile_id as string | null)) ?? null;
    if (authId) {
      profileIds.add(authId);
    }
  }

  if (profileIds.size > 0) {
    const ids = [...profileIds];
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name")
      .in("id", ids);

    const clientByAuthId = new Map<string, string>();
    for (const client of clients ?? []) {
      const authId =
        ((client.user_id as string | null) ?? (client.profile_id as string | null)) ?? null;
      if (authId) {
        clientByAuthId.set(authId, client.id as string);
      }
    }

    for (const profile of profiles ?? []) {
      const fullName = (profile.full_name as string | null)?.trim();
      if (!fullName) continue;
      const key = normalizeClientNameKey(fullName);
      if (!key || map.has(key)) continue;
      const clientId = clientByAuthId.get(profile.id as string);
      if (clientId) {
        map.set(key, clientId);
      }
    }
  }

  return map;
}

export function findClientIdByName(
  existingByName: Map<string, string>,
  name: string
): string | null {
  const key = normalizeClientNameKey(name);
  if (!key) return null;
  return existingByName.get(key) ?? null;
}
