import type { SupabaseClient } from "@supabase/supabase-js";
import { clientDisplayName, employmentCategoryLabel } from "@wayfinder/branding";
import {
  filterRetiredMarketClients,
  retiredMarketContextFromOffices,
} from "@wayfinder/supabase/retired-market";
import {
  isAdminTierRole,
  isFieldSpecialistRole,
  isSuperAdminRole,
  isSupervisorRole,
} from "@wayfinder/supabase/roles";
import { loadSupervisorScope } from "@wayfinder/supabase/supervisor-client-scope";

/** Georgia-only reporting (retired markets stay in DB but are not surfaced). */
export type ReportingState = "GA";

export type CaseloadClientRow = {
  id: string;
  name: string;
  officeState: ReportingState | null;
  officeName: string | null;
  serviceName: string | null;
  counselorName: string | null;
  employmentGoal: string | null;
};

async function loadProfileRole(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return (data?.role as string | undefined)?.toLowerCase() ?? null;
}

/** States available in the reporting app for admin-tier users. */
async function loadCatalogReportingStates(_admin: SupabaseClient): Promise<ReportingState[]> {
  // Georgia only in the reporting UI (TN catalog retired from staff-facing selectors).
  void _admin;
  return ["GA"];
}

async function loadRetiredMarketContext(admin: SupabaseClient) {
  const { data: offices } = await admin.from("offices").select("id, state, name");
  return retiredMarketContextFromOffices(
    (offices ?? []).map((o) => ({
      id: o.id as string,
      state: o.state as string | null,
      name: o.name as string | null,
    }))
  );
}

async function filterActiveMarketClientIds(
  admin: SupabaseClient,
  clientIds: Iterable<string>
): Promise<Set<string>> {
  const ids = [...clientIds];
  if (ids.length === 0) {
    return new Set();
  }

  const [ctx, clientsResult, servicesResult] = await Promise.all([
    loadRetiredMarketContext(admin),
    admin
      .from("clients")
      .select("id, office_id, referral_state, current_service_id")
      .in("id", ids),
    admin.from("services").select("id, name, state"),
  ]);

  const servicesById = new Map(
    (servicesResult.data ?? []).map((s) => [
      s.id as string,
      { state: s.state as string | null, name: s.name as string | null },
    ])
  );

  const active = filterRetiredMarketClients(
    (clientsResult.data ?? []).map((row) => ({
      id: row.id as string,
      office_id: row.office_id as string | null,
      referral_state: row.referral_state as string | null,
      current_service_id: row.current_service_id as string | null,
    })),
    ctx,
    servicesById
  );

  return new Set(active.map((row) => row.id as string));
}

async function loadScopedClientIds(
  admin: SupabaseClient,
  userId: string,
  role: string | null
): Promise<Set<string> | "all"> {
  if (!role || isAdminTierRole(role)) {
    return "all";
  }

  if (isFieldSpecialistRole(role)) {
    const { data: links } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", userId);
    return filterActiveMarketClientIds(
      admin,
      (links ?? []).map((l) => l.client_id as string)
    );
  }

  if (isSupervisorRole(role)) {
    const scope = await loadSupervisorScope(admin, userId);
    const clientIds = new Set<string>();
    const retired = await loadRetiredMarketContext(admin);
    const activeOfficeIds = scope.officeIds.filter((id) => !retired.retiredOfficeIds.has(id));

    if (activeOfficeIds.length > 0) {
      const { data: officeClients } = await admin
        .from("clients")
        .select("id")
        .in("office_id", activeOfficeIds);
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

    return filterActiveMarketClientIds(admin, clientIds);
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
    const rosterName = typeof c.full_name === "string" ? c.full_name.trim() : "";
    const profileName = authId ? (profileById.get(authId) ?? null) : null;
    return {
      id: c.id as string,
      name: clientDisplayName({
        // Roster name first so clients without a login/email still resolve.
        full_name: rosterName || profileName,
        contact_email: c.contact_email as string | null,
        id: c.id as string,
      }),
      officeState: state === "GA" ? state : null,
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
  const states = new Set<ReportingState>();

  if (isAdminTierRole(role)) {
    for (const state of await loadCatalogReportingStates(admin)) {
      states.add(state);
    }
  }

  const scope = await loadScopedClientIds(admin, userId, role);
  if (scope !== "all" && scope.size === 0) {
    return [...states].sort();
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
    return [...states].sort();
  }

  for (const row of data ?? []) {
    const embed = row.offices as { state?: string } | { state?: string }[] | null;
    const state = Array.isArray(embed) ? embed[0]?.state : embed?.state;
    if (state === "GA") {
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
  if (opts.state !== "GA") {
    return [];
  }
  const role = await loadProfileRole(admin, userId);
  const scope = await loadScopedClientIds(admin, userId, role);
  if (scope !== "all" && scope.size === 0) {
    return [];
  }

  const limit = opts.limit ?? 25;
  const qRaw = opts.query?.trim() ?? "";
  const q = qRaw.toLowerCase();
  // When searching, pull a wider page so in-memory name/office/service matches aren't cut off
  // by email-sorted pagination (null emails used to sort last and disappear).
  const fetchLimit = q ? Math.max(limit * 8, 100) : limit;

  let clientQuery = admin
    .from("clients")
    .select(
      "id, full_name, user_id, profile_id, contact_email, office_id, counselor_id, current_service_id, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other, offices!inner(state)"
    )
    .eq("offices.state", opts.state)
    .order("full_name", { ascending: true })
    .limit(fetchLimit);

  if (scope !== "all") {
    clientQuery = clientQuery.in("id", [...scope]);
  }

  if (qRaw) {
    // Strip PostgREST or/ilike metacharacters so the filter stays valid.
    const escaped = qRaw.replace(/[%_,]/g, "").trim();
    if (escaped) {
      clientQuery = clientQuery.or(
        `full_name.ilike.%${escaped}%,contact_email.ilike.%${escaped}%`
      );
    }
  }

  const { data: rows, error } = await clientQuery;
  if (error || !rows?.length) {
    return [];
  }

  const hydrated = await hydrateClients(admin, rows as Record<string, unknown>[]);
  if (!q) {
    return hydrated.slice(0, limit);
  }

  return hydrated
    .filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.officeName?.toLowerCase().includes(q) ||
        c.serviceName?.toLowerCase().includes(q)
    )
    .slice(0, limit);
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
      "id, full_name, user_id, profile_id, contact_email, office_id, counselor_id, current_service_id, employment_goal_primary, employment_goal_primary_other, employment_goal_secondary, employment_goal_secondary_other"
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
    isFieldSpecialistRole(role) ||
    isSupervisorRole(role) ||
    isAdminTierRole(role) ||
    isSuperAdminRole(role);
  if (!allowed) {
    throw new Error("Forbidden");
  }
  return { role, isAdmin: isAdminTierRole(role) };
}
