import { clientDisplayName } from "@wayfinder/branding";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type Admin = ReturnType<typeof createServiceRoleClient>;

type ClientNameRow = {
  id: string;
  contact_email?: string | null;
  user_id?: string | null;
  profile_id?: string | null;
  full_name?: string | null;
};

/** Roster names first, then login profile, then email — never a UUID. */
export async function loadClientDisplayNameById(
  admin: Admin,
  clientIds: string[]
): Promise<Map<string, string>> {
  const ids = [...new Set(clientIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) {
    return map;
  }

  let clientRows: ClientNameRow[] = [];
  {
    const withName = await admin
      .from("clients")
      .select("id, contact_email, user_id, profile_id, full_name")
      .in("id", ids);
    if (withName.error) {
      const fallback = await admin
        .from("clients")
        .select("id, contact_email, user_id, profile_id")
        .in("id", ids);
      clientRows = (fallback.data ?? []) as ClientNameRow[];
    } else {
      clientRows = (withName.data ?? []) as ClientNameRow[];
    }
  }

  const authIds = [
    ...new Set(
      clientRows
        .flatMap((c) => [c.user_id, c.profile_id])
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const { data: profiles } = authIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", authIds)
    : { data: [] as { id: string; full_name: string | null }[] };

  const nameByAuth = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
  );

  for (const c of clientRows) {
    const authId = (c.user_id ?? c.profile_id) ?? null;
    map.set(
      c.id,
      clientDisplayName({
        full_name: (c.full_name ?? null) || (authId ? nameByAuth.get(authId) ?? null : null),
        contact_email: c.contact_email ?? null,
        id: c.id,
      })
    );
  }

  return map;
}
