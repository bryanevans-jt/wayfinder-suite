/**
 * Read-only org client list for Accounts Specialist (and other canViewClientProfiles
 * non–field-specialist roles). Service-role reads after app role check.
 */

import {
  clientDisplayNameFromRosterAndProfile,
  clientNameSortKey,
  compareClientNameSortKeys,
  displayServiceCatalogName,
} from "@wayfinder/branding";
import {
  canViewClientProfiles,
  isFieldSpecialistRole,
} from "@wayfinder/supabase/roles";
import {
  fetchAllPostgrestRows,
  fetchAllPostgrestRowsByIn,
} from "@wayfinder/supabase/postgrest-fetch-all";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStaffNameById } from "@/lib/staff-names";

export type AccountsClientListRow = {
  clientId: string;
  clientName: string;
  sortLastName: string;
  sortFirstName: string;
  serviceName: string | null;
  stageTitle: string | null;
  assignedEsName: string | null;
  supervisorName: string | null;
};

/** Accounts Clients list: view profiles, but not the ES/TS caseload board. */
export function canAccessAccountsClientsList(
  role: string | null | undefined
): boolean {
  return canViewClientProfiles(role) && !isFieldSpecialistRole(role);
}

/** Pure: filter by name haystack (case-insensitive). */
export function filterAccountsClientListRows(
  rows: readonly AccountsClientListRow[],
  query: string
): AccountsClientListRow[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...rows];
  return rows.filter((row) => {
    const hay = [
      row.clientName,
      row.serviceName ?? "",
      row.stageTitle ?? "",
      row.assignedEsName ?? "",
      row.supervisorName ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

/**
 * Resolve supervisor user id: prefer clients.supervisor_user_id, else first
 * supervisor linked to the assigned ES via supervisor_es_assignments.
 */
export function resolveAccountsClientSupervisorUserId(opts: {
  clientSupervisorUserId: string | null | undefined;
  assignedEsUserId: string | null | undefined;
  supervisorByEsUserId: ReadonlyMap<string, string>;
}): string | null {
  const direct = (opts.clientSupervisorUserId ?? "").trim();
  if (direct) return direct;
  const esId = (opts.assignedEsUserId ?? "").trim();
  if (!esId) return null;
  return opts.supervisorByEsUserId.get(esId) ?? null;
}

export async function loadAccountsClientsList(
  admin: SupabaseClient
): Promise<AccountsClientListRow[]> {
  const clients = await fetchAllPostgrestRows<{
    id: string;
    full_name: string | null;
    contact_email: string | null;
    user_id: string | null;
    profile_id: string | null;
    current_service_id: string | null;
    current_stage_id: string | null;
    supervisor_user_id: string | null;
    office_id: string | null;
    is_demo: boolean | null;
    archived_at: string | null;
  }>(
    admin,
    "clients",
    "id, full_name, contact_email, user_id, profile_id, current_service_id, current_stage_id, supervisor_user_id, office_id, is_demo, archived_at",
    {
      order: { column: "id", ascending: true },
      applyFilters: (q) => q.is("archived_at", null).eq("is_demo", false),
    }
  );

  if (clients.length === 0) return [];

  const clientIds = clients.map((c) => c.id);
  const profileIds = [
    ...new Set(
      clients
        .flatMap((c) => [c.user_id, c.profile_id])
        .filter((id): id is string => Boolean(id))
    ),
  ];
  const serviceIds = [
    ...new Set(
      clients.map((c) => c.current_service_id).filter((id): id is string => Boolean(id))
    ),
  ];
  const stageIds = [
    ...new Set(
      clients.map((c) => c.current_stage_id).filter((id): id is string => Boolean(id))
    ),
  ];

  const [profiles, services, stages, assignments, supervisorLinks] = await Promise.all([
    profileIds.length === 0
      ? Promise.resolve([])
      : fetchAllPostgrestRowsByIn<{
          id: string;
          full_name: string | null;
          first_name: string | null;
          last_name: string | null;
        }>(
          admin,
          "profiles",
          "id, full_name, first_name, last_name",
          "id",
          profileIds,
          { order: { column: "id", ascending: true } }
        ),
    serviceIds.length === 0
      ? Promise.resolve([])
      : fetchAllPostgrestRowsByIn<{ id: string; name: string | null }>(
          admin,
          "services",
          "id, name",
          "id",
          serviceIds,
          { order: { column: "id", ascending: true } }
        ),
    stageIds.length === 0
      ? Promise.resolve([])
      : fetchAllPostgrestRowsByIn<{ id: string; title: string | null }>(
          admin,
          "service_milestones",
          "id, title",
          "id",
          stageIds,
          { order: { column: "id", ascending: true } }
        ),
    fetchAllPostgrestRowsByIn<{ client_id: string; es_user_id: string }>(
      admin,
      "es_client_assignments",
      "client_id, es_user_id",
      "client_id",
      clientIds,
      { order: { column: "client_id", ascending: true } }
    ),
    admin.from("supervisor_es_assignments").select("supervisor_user_id, es_user_id"),
  ]);

  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const esByClient = new Map<string, string>();
  for (const row of assignments) {
    if (!esByClient.has(row.client_id) && row.es_user_id) {
      esByClient.set(row.client_id, row.es_user_id);
    }
  }

  const supervisorByEs = new Map<string, string>();
  for (const link of supervisorLinks.data ?? []) {
    const esId = link.es_user_id as string;
    const supId = link.supervisor_user_id as string;
    if (esId && supId && !supervisorByEs.has(esId)) {
      supervisorByEs.set(esId, supId);
    }
  }

  const staffIds = [
    ...new Set(
      [
        ...esByClient.values(),
        ...clients.map((c) => c.supervisor_user_id).filter((id): id is string => Boolean(id)),
        ...supervisorByEs.values(),
      ].filter(Boolean)
    ),
  ];
  const staffNames = await loadStaffNameById(admin, staffIds, "Staff");

  const rows: AccountsClientListRow[] = clients.map((client) => {
    const profile =
      profileById.get(client.user_id ?? "") ??
      profileById.get(client.profile_id ?? "") ??
      null;
    const displayName = clientDisplayNameFromRosterAndProfile(client, profile);
    const sort = clientNameSortKey({
      displayName,
      first_name: profile?.first_name,
      last_name: profile?.last_name,
    });
    const service = client.current_service_id
      ? serviceById.get(client.current_service_id)
      : null;
    const stage = client.current_stage_id
      ? stageById.get(client.current_stage_id)
      : null;
    const esUserId = esByClient.get(client.id) ?? null;
    const supervisorUserId = resolveAccountsClientSupervisorUserId({
      clientSupervisorUserId: client.supervisor_user_id,
      assignedEsUserId: esUserId,
      supervisorByEsUserId: supervisorByEs,
    });

    return {
      clientId: client.id,
      clientName: displayName,
      sortLastName: sort.lastName,
      sortFirstName: sort.firstName,
      serviceName: service?.name
        ? displayServiceCatalogName(service.name)
        : null,
      stageTitle: stage?.title ?? null,
      assignedEsName: esUserId
        ? (staffNames.get(esUserId) ?? "Employment Specialist")
        : null,
      supervisorName: supervisorUserId
        ? (staffNames.get(supervisorUserId) ?? "Supervisor")
        : null,
    };
  });

  rows.sort((a, b) =>
    compareClientNameSortKeys(
      {
        lastName: a.sortLastName,
        firstName: a.sortFirstName,
        displayName: a.clientName,
      },
      {
        lastName: b.sortLastName,
        firstName: b.sortFirstName,
        displayName: b.clientName,
      }
    )
  );

  return rows;
}
