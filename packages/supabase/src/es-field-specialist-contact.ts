import type { createServiceRoleClient } from "./admin-server";

type Admin = ReturnType<typeof createServiceRoleClient>;

export type FieldSpecialistContact = {
  userId: string;
  /** Display name from profile / metadata. */
  fullName: string;
  /** Best-effort email from auth.users (service role). */
  email: string | null;
};

/**
 * Load Employment Specialist / Transition Specialist contact for clients (server-only, service role).
 * Resolves one assignee per client from es_client_assignments; name from profiles when available.
 */
export async function loadFieldSpecialistContactsByClientIds(
  admin: Admin,
  clientIds: string[]
): Promise<Map<string, FieldSpecialistContact | null>> {
  const out = new Map<string, FieldSpecialistContact | null>();
  const ids = [...new Set(clientIds.filter(Boolean))];
  for (const id of ids) {
    out.set(id, null);
  }
  if (ids.length === 0) {
    return out;
  }

  const { data: assignments, error } = await admin
    .from("es_client_assignments")
    .select("client_id, es_user_id")
    .in("client_id", ids);
  if (error) {
    console.error("[es-field-specialist-contact] assignments:", error.message);
    return out;
  }

  const esByClient = new Map<string, string>();
  for (const row of assignments ?? []) {
    const cid = row.client_id as string;
    const esId = row.es_user_id as string;
    if (!esByClient.has(cid)) {
      esByClient.set(cid, esId);
    }
  }

  const esUserIds = [...new Set([...esByClient.values()])];
  const nameById = new Map<string, string>();
  if (esUserIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, full_name, first_name, last_name")
      .in("id", esUserIds);
    for (const p of profiles ?? []) {
      const row = p as {
        id: string;
        full_name?: string | null;
        first_name?: string | null;
        last_name?: string | null;
      };
      const name =
        (row.full_name ?? "").trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
      if (name) {
        nameById.set(row.id, name);
      }
    }
  }

  const emailById = new Map<string, string>();
  try {
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data.users ?? []) {
      if (esUserIds.includes(u.id) && u.email) {
        emailById.set(u.id, u.email);
      }
    }
  } catch {
    // Email optional when Admin API unavailable
  }

  for (const [clientId, esId] of esByClient) {
    const fullName = nameById.get(esId) ?? "Employment Specialist";
    out.set(clientId, {
      userId: esId,
      fullName,
      email: emailById.get(esId) ?? null,
    });
  }

  return out;
}
