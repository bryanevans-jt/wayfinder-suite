import type { SupabaseClient } from "@supabase/supabase-js";
import { clientDisplayName, employmentCategoryLabel } from "@wayfinder/branding";
import {
  isAdminTierRole,
  isEsRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";

export type ReportingState = "GA" | "TN";

export type CaseloadClientRow = {
  id: string;
  name: string;
  officeState: ReportingState | null;
  officeName: string | null;
  serviceName: string | null;
  counselorName: string | null;
  employmentGoal: string | null;
};

type SupervisorScope = {
  officeIds: string[];
  esUserIds: string[];
};

async function loadProfileRole(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as string | undefined)?.toLowerCase() ?? null;
}

async function loadSupervisorScope(admin: SupabaseClient, supervisorUserId: string): Promise<SupervisorScope> {
  const [{ data: offices }, { data: esLinks }] = await Promise.all([
    admin.from("staff_office_assignments").select("office_id").eq("user_id", supervisorUserId),
    admin
      .from("supervisor_es_assignments")
      .select("es_user_id")
      .eq("supervisor_user_id", supervisorUserId),
  ]);

  const officeIds = (offices ?? []).map((o) => o.office_id as string);
  const officeSet = new Set(officeIds);
  const esUserIds = new Set((esLinks ?? []).map((e) => e.es_user_id as string));

  if (officeIds.length > 0) {
    const { data: staffOfficeLinks } = await admin
      .from("staff_office_assignments")
      .select("user_id, office_id")
      .in("office_id", officeIds);

    const candidateUserIds = new Set<string>();
    for (const link of staffOfficeLinks ?? []) {
      const userId = link.user_id as string;
      const officeId = link.office_id as string;
      if (userId !== supervisorUserId && officeSet.has(officeId)) {
        candidateUserIds.add(userId);
      }
    }

    if (candidateUserIds.size > 0) {
      const { data: esProfiles } = await admin
        .from("profiles")
        .select("id")
        .in("id", [...candidateUserIds])
        .eq("role", "es");
      for (const profile of esProfiles ?? []) {
        esUserIds.add(profile.id as string);
      }
    }
  }

  return { officeIds, esUserIds: [...esUserIds] };
}

async function loadScopedClientIds(
  admin: SupabaseClient,
  userId: string,
  role: string | null
): Promise<Set<string> | "all"> {
  if (!role || isAdminTierRole(role)) {
    return "all";
  }

  if (isEsRole(role)) {
    const { data: links } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", userId);
    return new Set((links ?? []).map((l) => l.client_id as string));
  }

  if (isSupervisorRole(role)) {
    const scope = await loadSupervisorScope(admin, userId);
    const clientIds = new Set<string>();

    if (scope.officeIds.length > 0) {
      const { data: officeClients } = await admin
        .from("clients")
        .select("id")
        .in("office_id", scope.officeIds);
      for (const row of officeClients ?? []) {
        clientIds.add(row.id as string);
      }
    }

    if (scope.esUserIds.length > 0) {
      const { data: esClients } = await admin
        .from("es_client_assignments")
        .select("client_id")
        .in("es_user_id", scope.esUserIds);
      for (const row of esClients ?? []) {
        clientIds.add(row.client_id as string);
      }
    }

    return clientIds;
  }

  return new Set();
}

async function hydrateClients(
  admin: SupabaseClient,
  clientRows: Array<Record<string, unknown>>
): Promise<CaseloadClientRow[]> {
  if (clientRows.length === 0) return [];

  const authIds = [
    ...new Set(
      clientRows
        .flatMap((c) => [c.user_id, c.profile_id])
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const officeIds = [
    ...new Set(
      clientRows
        .map((c) => c.office_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const serviceIds = [
    ...new Set(
      clientRows
        .map((c) => c.current_service_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const counselorIds = [
    ...new Set(
      clientRows
        .map((c) => c.counselor_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const [{ data: profiles }, { data: offices }, { data: services }, { data: counselors }] =
    await Promise.all([
      authIds.length
        ? admin.from("profiles").select("id, full_name").in("id", authIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      officeIds.length
        ? admin.from("offices").select("id, name, state").in("id", officeIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; state: string | null }[] }),
      serviceIds.length
        ? admin.from("services").select("id, name").in("id", serviceIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
      counselorIds.length
        ? admin.from("counselors").select("id, name").in("id", counselorIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null }[] }),
    ]);

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const officeById = new Map((offices ?? []).map((o) => [o.id, o]));
  const serviceById = new Map((services ?? []).map((s) => [s.id, s.name]));
  const counselorById = new Map((counselors ?? []).map((c) => [c.id, c.name]));

  return clientRows.map((c) => {
    const authId = (c.user_id ?? c.profile_id) as string | null;
    const office = c.office_id ? officeById.get(c.office_id as string) : undefined;
    const state = (office?.state as ReportingState | null | undefined) ?? null;
    return {
      id: c.id as string,
      name: clientDisplayName({
        full_name: authId ? (profileById.get(authId) ?? null) : null,
        contact_email: c.contact_email as string | null,
        id: c.id as string,
      }),
      officeState: state === "GA" || state === "TN" ? state : null,
      officeName: office?.name ?? null,
      serviceName: c.current_service_id ? (serviceById.get(c.current_service_id as string) ?? null) : null,
      counselorName: c.counselor_id ? (counselorById.get(c.counselor_id as string) ?? null) : null,
      employmentGoal: employmentCategoryLabel(
        c.employment_goal_primary as string | null,
        c.employment_goal_primary_other as string | null
      ),
    };
  });
}

export async function getAvailableReportingStates(
  admin: SupabaseClient,
  userId: string
): Promise<ReportingState[]> {
  const role = await loadProfileRole(admin, userId);
  const scope = await loadScopedClientIds(admin, userId, role);
  if (scope !== "all" && scope.size === 0) {
    return [];
  }

  let query = admin
    .from("clients")
    .select("office_id, offices!inner(state)")
    .not("office_id", "is", null);

  if (scope !== "all") {
    query = query.in("id", [...scope]);
  }

  const { data, error } = await query;
  if (error) {
    return [];
  }

  const states = new Set<ReportingState>();
  for (const row of data ?? []) {
    const embed = row.offices as { state?: string } | { state?: string }[] | null;
    const state = Array.isArray(embed) ? embed[0]?.state : embed?.state;
    if (state === "GA" || state === "TN") {
      states.add(state);
    }
  }
  return [...states].sort();
}

export async function searchCaseloadClients(
  admin: SupabaseClient,
  userId: string,
  opts: { state: ReportingState; query?: string; limit?: number }
): Promise<CaseloadClientRow[]> {
  const role = await loadProfileRole(admin, userId);
  const scope = await loadScopedClientIds(admin, userId, role);
  if (scope !== "all" && scope.size === 0) {
    return [];
  }

  const limit = opts.limit ?? 25;
  let clientQuery = admin
    .from("clients")
    .select(
      "id, user_id, profile_id, contact_email, office_id, counselor_id, current_service_id, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other, offices!inner(state)"
    )
    .eq("offices.state", opts.state)
    .order("contact_email", { ascending: true })
    .limit(limit);

  if (scope !== "all") {
    clientQuery = clientQuery.in("id", [...scope]);
  }

  const { data: rows, error } = await clientQuery;
  if (error || !rows?.length) {
    return [];
  }

  const hydrated = await hydrateClients(admin, rows as Record<string, unknown>[]);
  const q = opts.query?.trim().toLowerCase();
  if (!q) {
    return hydrated;
  }

  return hydrated.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.officeName?.toLowerCase().includes(q) ||
      c.serviceName?.toLowerCase().includes(q)
  );
}

export async function userCanAccessClient(
  admin: SupabaseClient,
  userId: string,
  clientId: string
): Promise<boolean> {
  const role = await loadProfileRole(admin, userId);
  const scope = await loadScopedClientIds(admin, userId, role);
  if (scope === "all") {
    return true;
  }
  return scope.has(clientId);
}

export async function getCaseloadClientById(
  admin: SupabaseClient,
  userId: string,
  clientId: string
): Promise<CaseloadClientRow | null> {
  const allowed = await userCanAccessClient(admin, userId, clientId);
  if (!allowed) {
    return null;
  }

  const { data: row } = await admin
    .from("clients")
    .select(
      "id, user_id, profile_id, contact_email, office_id, counselor_id, current_service_id, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!row) {
    return null;
  }

  const [client] = await hydrateClients(admin, [row as Record<string, unknown>]);
  return client ?? null;
}

export async function assertReportingUser(
  admin: SupabaseClient,
  userId: string
): Promise<{ role: string | null; isAdmin: boolean }> {
  const role = await loadProfileRole(admin, userId);
  const allowed =
    isEsRole(role) || isSupervisorRole(role) || isAdminTierRole(role) || isSuperAdminRole(role);
  if (!allowed) {
    throw new Error("Forbidden");
  }
  return { role, isAdmin: isAdminTierRole(role) };
}
