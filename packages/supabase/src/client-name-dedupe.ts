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
  trimmed = trimmed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['.`\-]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return trimmed.toLowerCase();
}

/** Additional keys for first+last matching (drops middle names / initials). */
export function clientNameMatchKeys(name: string): string[] {
  const normalized = normalizeClientNameKey(name);
  if (!normalized) {
    return [];
  }
  const keys = new Set<string>([normalized, normalized.replace(/\s+/g, "")]);
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    keys.add(`${parts[0]} ${parts[parts.length - 1]}`);
    keys.add(`${parts[0]}${parts[parts.length - 1]}`);
  }
  return [...keys];
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

  function registerName(clientId: string, rawName: string | null | undefined) {
    const fullName = rawName?.trim();
    if (!fullName) return;
    for (const key of clientNameMatchKeys(fullName)) {
      if (key && !map.has(key)) {
        map.set(key, clientId);
      }
    }
  }

  for (const client of clients ?? []) {
    const clientId = client.id as string;
    registerName(clientId, client.full_name as string | null);

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
      const clientId = clientByAuthId.get(profile.id as string);
      if (clientId) {
        registerName(clientId, profile.full_name as string | null);
      }
    }
  }

  return map;
}

export async function loadClientIdByContactEmail(
  admin: SupabaseClient,
  email: string
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const { data } = await admin
    .from("clients")
    .select("id")
    .ilike("contact_email", normalized)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return (data?.id as string | undefined) ?? null;
}

export function findClientIdByName(
  existingByName: Map<string, string>,
  name: string
): string | null {
  for (const key of clientNameMatchKeys(name)) {
    const id = existingByName.get(key);
    if (id) {
      return id;
    }
  }
  return null;
}
