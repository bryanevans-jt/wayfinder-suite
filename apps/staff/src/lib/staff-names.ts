import { staffDisplayName } from "@wayfinder/branding";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type Admin = ReturnType<typeof createServiceRoleClient>;

type StaffProfileNameRow = {
  id: string;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
};

/** Resolve display names without importing the @wayfinder/supabase barrel (next/headers). */
export async function loadStaffNameById(
  admin: Admin,
  userIds: string[],
  unknownLabel = "Employment Specialist"
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) {
    return map;
  }

  let profileRows: StaffProfileNameRow[] = [];
  {
    const selectShapes = [
      "id, full_name, first_name, last_name, email",
      "id, full_name, first_name, last_name",
      "id, full_name, email",
      "id, full_name",
    ] as const;
    for (const cols of selectShapes) {
      const result = await admin.from("profiles").select(cols).in("id", ids);
      if (!result.error) {
        profileRows = (result.data ?? []) as unknown as StaffProfileNameRow[];
        break;
      }
      if (!/does not exist|Could not find the '|schema cache/i.test(result.error.message)) {
        break;
      }
    }
  }

  const byId = new Map(profileRows.map((p) => [p.id, p]));

  let emailById = new Map<string, string>();
  let metaById = new Map<string, Record<string, unknown>>();
  const needsAuthFallback = ids.some((id) => {
    const profile = byId.get(id);
    const preview = staffDisplayName({
      full_name: profile?.full_name,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
      email: profile?.email,
      id,
    });
    return preview === id || preview === "Unknown";
  });

  if (needsAuthFallback) {
    try {
      const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
      emailById = new Map(
        (data.users ?? [])
          .filter((u) => ids.includes(u.id))
          .map((u) => [u.id, u.email ?? ""])
      );
      metaById = new Map(
        (data.users ?? [])
          .filter((u) => ids.includes(u.id))
          .map((u) => [u.id, (u.user_metadata ?? {}) as Record<string, unknown>])
      );
    } catch {
      // Profile fields alone still apply.
    }
  }

  for (const id of ids) {
    const profile = byId.get(id);
    const meta = metaById.get(id) as
      | { full_name?: string; name?: string; first_name?: string; last_name?: string }
      | undefined;
    const label = staffDisplayName({
      full_name: profile?.full_name ?? meta?.full_name ?? meta?.name ?? null,
      first_name: profile?.first_name ?? meta?.first_name ?? null,
      last_name: profile?.last_name ?? meta?.last_name ?? null,
      email: profile?.email || emailById.get(id) || null,
      id,
    });
    map.set(id, label && label !== id ? label : unknownLabel);
  }

  return map;
}
