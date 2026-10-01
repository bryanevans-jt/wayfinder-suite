import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { fetchAllPostgrestRows } from "@wayfinder/supabase/postgrest-fetch-all";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[^\w\s.-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export type PreEtsTestRosterListItem = {
  authorizationId: string;
  fileLabel: string;
  schoolName: string;
  groupName: string;
  authType: string;
  eligibleStudentCount: number;
};

export async function listPreEtsTestRostersForMonth(
  admin: AdminClient,
  serviceMonthInput: string
): Promise<{ serviceMonth: string; rosters: PreEtsTestRosterListItem[] }> {
  const serviceMonth = normalizeServiceMonth(serviceMonthInput);

  const authorizations = await fetchAllPostgrestRows<{
    id: string;
    auth_type: string;
    pre_ets_schools: { name: string } | { name: string }[] | null;
    pre_ets_program_groups:
      | { group_name: string }
      | { group_name: string }[]
      | null;
  }>(admin, "pre_ets_authorizations", "id, auth_type, pre_ets_schools(name), pre_ets_program_groups(group_name)", {
    order: { column: "created_at", ascending: true },
    applyFilters: (q) => q.eq("service_month", serviceMonth),
  });

  const authIds = authorizations.map((a) => a.id);
  if (authIds.length === 0) {
    return { serviceMonth, rosters: [] };
  }

  const entries = await fetchAllPostgrestRows<{
    authorization_id: string;
    not_approved: boolean;
    pre_ets_students: { participant_id: string | null } | { participant_id: string | null }[] | null;
  }>(
    admin,
    "pre_ets_roster_entries",
    "authorization_id, not_approved, pre_ets_students(participant_id)",
    {
      applyFilters: (q) => q.in("authorization_id", authIds),
    }
  );

  const eligibleByAuth = new Map<string, number>();
  for (const entry of entries) {
    if (entry.not_approved) continue;
    const st = relationOne(entry.pre_ets_students);
    if (!st?.participant_id?.trim()) continue;
    const authId = entry.authorization_id;
    eligibleByAuth.set(authId, (eligibleByAuth.get(authId) ?? 0) + 1);
  }

  const rosters: PreEtsTestRosterListItem[] = [];
  for (const auth of authorizations) {
    const eligibleStudentCount = eligibleByAuth.get(auth.id) ?? 0;
    if (eligibleStudentCount === 0) continue;

    const school = relationOne(auth.pre_ets_schools);
    const group = relationOne(auth.pre_ets_program_groups);
    const schoolName = school?.name ?? "";
    const groupName = group?.group_name ?? "";
    const schoolPart = sanitizeFileNamePart(schoolName || "School");
    const groupPart = sanitizeFileNamePart(groupName || "Group");

    rosters.push({
      authorizationId: auth.id,
      fileLabel: `${schoolPart} - ${groupPart}`,
      schoolName,
      groupName,
      authType: auth.auth_type,
      eligibleStudentCount,
    });
  }

  return { serviceMonth, rosters };
}
