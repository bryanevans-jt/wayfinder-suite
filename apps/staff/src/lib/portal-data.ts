import {
  clientDisplayName,
  dedupeServicesForSelect,
  resolveStaffDisplayName,
  serviceDisplayName,
} from "@wayfinder/branding";
import { createServerClient, isAdminTierRole, isSuperAdminRole, buildClientActivityFkIds } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { getAppSession } from "@wayfinder/supabase/preview-server";
import type { PortalTier } from "@wayfinder/supabase/roles";
import { redirect } from "next/navigation";
import {
  collectReferencedOfficeIds,
  filterOfficesForPicker,
  queryAllOffices,
  type OfficeRecord,
} from "@/lib/office-visibility";

export async function requirePortalPage(minTier: PortalTier) {
  const session = await getAppSession();
  if (!session) {
    redirect("/login");
  }

  const supabase = await createServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", session.actorUserId)
    .maybeSingle();

  if (!profile?.is_active) {
    redirect("/account-inactive");
  }

  const role = session.isPreviewing ? session.effectiveRole : profile.role;
  const allowed =
    minTier === "super_admin"
      ? isSuperAdminRole(role)
      : minTier === "admin"
        ? isAdminTierRole(role)
        : role === "supervisor" || isAdminTierRole(role);

  if (!allowed) {
    redirect("/dashboard");
  }

  return { user: { id: session.effectiveUserId }, role: role as string };
}

export type PortalBootstrap = {
  offices: {
    id: string;
    name: string;
    city: string | null;
    state: string | null;
    is_hidden: boolean;
  }[];
  services: { id: string; name: string }[];
  /** Raw service rows (for edit dropdowns — includes legacy ids). */
  serviceCatalog: { id: string; name: string; state?: string | null }[];
  serviceMilestones: {
    id: string;
    service_id: string;
    title: string;
    order_index: number;
  }[];
  counselors: {
    id: string;
    full_name: string;
    office_id: string | null;
    office_ids: string[];
  }[];
  esUsers: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string;
    office_ids: string[];
  }[];
  /** ES and supervisors eligible for direct client caseload assignment. */
  caseloadAssignees: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string;
    office_ids: string[];
    role: "es" | "supervisor";
    is_active: boolean;
  }[];
  esStaff: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string;
    is_active: boolean;
    office_ids: string[];
    client_count: number;
  }[];
  counselorStaff: {
    id: string;
    full_name: string;
    email: string | null;
    user_id: string | null;
    has_login: boolean;
    is_active: boolean;
    office_id: string | null;
    office_ids: string[];
    client_count: number;
  }[];
  supervisorStaff: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string;
    is_active: boolean;
    office_ids: string[];
    es_count: number;
  }[];
  supervisors: { id: string; email: string; full_name: string | null; display_name: string }[];
  admins: {
    id: string;
    email: string;
    full_name: string | null;
    display_name: string;
    role: "admin" | "super_admin";
    is_active: boolean;
    is_protected: boolean;
  }[];
  staffNameById: Record<string, string>;
  clients: {
    id: string;
    contact_email: string | null;
    office_id: string | null;
    es_user_ids: string[];
    full_name: string | null;
    user_id: string | null;
    current_service_id: string | null;
    service_name: string | null;
    current_stage_id: string | null;
    stage_title: string | null;
    counselor_id: string | null;
    counselor_name: string | null;
    archived_at: string | null;
  }[];
  counselorOfficeLinks: { id: string; counselor_id: string; office_id: string }[];
  staffOfficeLinks: { id: string; user_id: string; office_id: string }[];
  supervisorEsLinks: { id: string; supervisor_user_id: string; es_user_id: string }[];
  esClientLinks: { id: string; es_user_id: string; client_id: string }[];
};

export async function loadPortalBootstrap(
  admin: ReturnType<typeof createServiceRoleClient>,
  scope?: { supervisorUserId?: string; officeIds?: string[]; esUserIds?: string[] },
  options?: { includeHiddenOffices?: boolean }
): Promise<PortalBootstrap> {
  let officesRows: OfficeRecord[] = await queryAllOffices(admin);

  let clientsQuery = await admin
    .from("clients")
    .select(
      "id, contact_email, office_id, user_id, profile_id, full_name, current_service_id, current_stage_id, counselor_id, archived_at"
    );
  if (clientsQuery.error?.message.includes("full_name")) {
    clientsQuery = await admin.from("clients").select(
      "id, contact_email, office_id, user_id, profile_id, current_service_id, current_stage_id, counselor_id, archived_at"
    );
  }
  if (clientsQuery.error?.message.includes("archived_at")) {
    clientsQuery = await admin
      .from("clients")
      .select(
        "id, contact_email, office_id, user_id, profile_id, current_service_id, current_stage_id, counselor_id"
      );
  }
  if (clientsQuery.error) {
    clientsQuery = await admin.from("clients").select("id, contact_email, office_id");
  }

  let servicesQuery = await admin.from("services").select("id, name, state").order("name");
  type ServiceRowLoaded = { id: string; name: string; state?: string | null };
  let servicesRaw: ServiceRowLoaded[];
  if (servicesQuery.error?.message.includes("state")) {
    const fallback = await admin.from("services").select("id, name").order("name");
    servicesRaw = (fallback.data ?? []) as ServiceRowLoaded[];
  } else {
    servicesRaw = (servicesQuery.data ?? []) as ServiceRowLoaded[];
  }

  let milestonesQuery = await admin
    .from("service_milestones")
    .select("id, title, service_id, order_index")
    .order("order_index");
  type MilestoneRowLoaded = {
    id: string;
    title: string;
    service_id: string;
    order_index?: number;
  };
  let milestones: MilestoneRowLoaded[];
  if (milestonesQuery.error?.message.includes("order_index")) {
    const fallback = await admin
      .from("service_milestones")
      .select("id, title, service_id")
      .order("title");
    milestones = (fallback.data ?? []) as MilestoneRowLoaded[];
  } else {
    milestones = (milestonesQuery.data ?? []) as MilestoneRowLoaded[];
  }

  const [
    { data: counselorOfficeLinks },
    { data: staffOfficeLinks },
    { data: supervisorEsLinks },
    { data: esClientLinks },
  ] = await Promise.all([
    admin.from("counselor_office_assignments").select("id, counselor_id, office_id"),
    admin.from("staff_office_assignments").select("id, user_id, office_id"),
    admin.from("supervisor_es_assignments").select("id, supervisor_user_id, es_user_id"),
    admin.from("es_client_assignments").select("id, es_user_id, client_id"),
  ]);

  let counselorsQuery = await admin
    .from("counselors")
    .select("id, full_name, office_id, user_id")
    .order("full_name");
  let counselors: Array<{
    id: string;
    full_name: string;
    office_id: string | null;
    user_id?: string | null;
  }> = (counselorsQuery.data ?? []) as Array<{
    id: string;
    full_name: string;
    office_id: string | null;
    user_id?: string | null;
  }>;
  if (counselorsQuery.error?.message.includes("user_id")) {
    const fallback = await admin
      .from("counselors")
      .select("id, full_name, office_id")
      .order("full_name");
    if (fallback.error) throw new Error(fallback.error.message);
    counselors = (fallback.data ?? []) as typeof counselors;
  } else if (counselorsQuery.error) {
    throw new Error(counselorsQuery.error.message);
  }

  let profilesQuery = await admin
    .from("profiles")
    .select("id, role, full_name, first_name, last_name, is_active");
  if (profilesQuery.error?.message.includes("first_name")) {
    profilesQuery = await admin.from("profiles").select("id, role, full_name, is_active");
  }
  const profiles = profilesQuery.data;

  const authUsers = await admin.auth.admin.listUsers({ perPage: 1000 });
  const emailById = new Map(
    (authUsers.data.users ?? []).map((u) => [u.id, u.email ?? ""])
  );
  const authMetaById = new Map(
    (authUsers.data.users ?? []).map((u) => [u.id, u.user_metadata ?? {}])
  );

  const { data: protectedRows } = await admin
    .from("system_protected_profiles")
    .select("profile_id");
  const protectedIds = new Set((protectedRows ?? []).map((r) => r.profile_id as string));

  type ProfileRow = {
    id: string;
    role: string;
    full_name: string | null;
    first_name?: string | null;
    last_name?: string | null;
    is_active?: boolean | null;
  };

  const profileById = new Map((profiles ?? []).map((p) => [p.id as string, p as ProfileRow]));

  function staffNameFor(userId: string): string {
    const profile = profileById.get(userId);
    return resolveStaffDisplayName(
      userId,
      profile,
      emailById.get(userId) ?? "",
      authMetaById.get(userId)
    );
  }

  const coLinks = counselorOfficeLinks ?? [];
  const counselorOfficeIds = new Map<string, Set<string>>();
  for (const c of counselors ?? []) {
    const set = new Set<string>();
    if (c.office_id) set.add(c.office_id as string);
    for (const link of coLinks) {
      if (link.counselor_id === c.id) set.add(link.office_id as string);
    }
    counselorOfficeIds.set(c.id as string, set);
  }

  const staffOfficeByUser = new Map<string, string[]>();
  for (const link of staffOfficeLinks ?? []) {
    const uid = link.user_id as string;
    const list = staffOfficeByUser.get(uid) ?? [];
    list.push(link.office_id as string);
    staffOfficeByUser.set(uid, list);
  }

  const activeProfiles = (profiles ?? []).filter((p) => p.is_active !== false);

  let esProfiles = activeProfiles.filter((p) => p.role === "es");
  const allEsProfiles = (profiles ?? []).filter((p) => p.role === "es");
  const allSupervisorProfiles = (profiles ?? []).filter((p) => p.role === "supervisor");
  let clientRows = clientsQuery.data ?? [];

  if (scope?.supervisorUserId) {
    const officeSet = new Set(scope.officeIds ?? []);
    const esSet = new Set(scope.esUserIds ?? []);
    esSet.add(scope.supervisorUserId);
    esProfiles = esProfiles.filter(
      (p) => esSet.has(p.id as string) || (staffOfficeByUser.get(p.id as string) ?? []).some((o) => officeSet.has(o))
    );
    clientRows = clientRows.filter((c) => {
      if (c.office_id && officeSet.has(c.office_id as string)) return true;
      return (esClientLinks ?? []).some(
        (l) =>
          l.client_id === c.id &&
          (l.es_user_id === scope.supervisorUserId ||
            esSet.has(l.es_user_id as string) ||
            esProfiles.some((e) => e.id === l.es_user_id))
      );
    });
  }

  const esClientByClient = new Map<string, string[]>();
  const esClientCountByUser = new Map<string, number>();
  const esCountBySupervisor = new Map<string, number>();
  for (const link of esClientLinks ?? []) {
    const cid = link.client_id as string;
    const esId = link.es_user_id as string;
    const list = esClientByClient.get(cid) ?? [];
    list.push(esId);
    esClientByClient.set(cid, list);
    esClientCountByUser.set(esId, (esClientCountByUser.get(esId) ?? 0) + 1);
  }
  for (const link of supervisorEsLinks ?? []) {
    const supId = link.supervisor_user_id as string;
    esCountBySupervisor.set(supId, (esCountBySupervisor.get(supId) ?? 0) + 1);
  }

  function clientsForCounselor(counselorId: string, loginId: string | null): number {
    let count = 0;
    for (const row of clientRows) {
      const ref = row.counselor_id as string | null;
      if (!ref) continue;
      if (ref === counselorId || (loginId && ref === loginId)) count++;
    }
    return count;
  }

  const profileNameById = new Map(
    (profiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
  );
  const serviceNameById = new Map(
    servicesRaw.map((s) => [
      s.id,
      serviceDisplayName({ id: s.id, name: s.name, state: s.state ?? null }),
    ])
  );
  const stageTitleById = new Map(
    (milestones ?? []).map((m) => [m.id as string, m.title as string])
  );
  const counselorNameById = new Map(
    (counselors ?? []).map((c) => [c.id as string, c.full_name as string])
  );

  const staffNameById: Record<string, string> = {};
  for (const p of profiles ?? []) {
    staffNameById[p.id as string] = staffNameFor(p.id as string);
  }
  for (const link of esClientLinks ?? []) {
    const esId = link.es_user_id as string;
    if (!staffNameById[esId]) {
      staffNameById[esId] = staffNameFor(esId);
    }
  }

  let counselorOfficeLinksOut = (counselorOfficeLinks ?? []) as PortalBootstrap["counselorOfficeLinks"];
  let staffOfficeLinksOut = (staffOfficeLinks ?? []) as PortalBootstrap["staffOfficeLinks"];
  let supervisorEsLinksOut = (supervisorEsLinks ?? []) as PortalBootstrap["supervisorEsLinks"];
  let esClientLinksOut = (esClientLinks ?? []) as PortalBootstrap["esClientLinks"];

  if (scope?.supervisorUserId) {
    const officeSet = new Set(scope.officeIds ?? []);
    for (const c of clientRows) {
      if (c.office_id) officeSet.add(c.office_id as string);
    }
    officesRows = officesRows.filter((o) => officeSet.has(o.id));

    const esSet = new Set(scope.esUserIds ?? []);
    esSet.add(scope.supervisorUserId);
    for (const p of esProfiles) esSet.add(p.id as string);

    supervisorEsLinksOut = supervisorEsLinksOut.filter(
      (l) => l.supervisor_user_id === scope.supervisorUserId
    );
    esClientLinksOut = esClientLinksOut.filter((l) => esSet.has(l.es_user_id));
    staffOfficeLinksOut = staffOfficeLinksOut.filter((l) => esSet.has(l.user_id));
    counselorOfficeLinksOut = counselorOfficeLinksOut.filter((l) =>
      officeSet.has(l.office_id)
    );
  }

  const scopedEsIds = scope?.supervisorUserId
    ? new Set([
        ...esProfiles.map((p) => p.id as string),
        ...(scope.esUserIds ?? []),
      ])
    : null;

  const referencedOfficeIds = collectReferencedOfficeIds(
    clientRows.map((client) => client.office_id as string | null),
    staffOfficeLinksOut.map((link) => link.office_id),
    counselorOfficeLinksOut.map((link) => link.office_id)
  );
  officesRows = filterOfficesForPicker(officesRows, {
    includeHidden: options?.includeHiddenOffices ?? false,
    alwaysIncludeIds: referencedOfficeIds,
  });

  return {
    offices: officesRows.map((o) => ({
      id: o.id,
      name: o.name,
      city: o.city ?? null,
      state: o.state ?? null,
      is_hidden: o.is_hidden === true,
    })),
    services: dedupeServicesForSelect(servicesRaw),
    serviceCatalog: servicesRaw.map((s) => ({
      id: s.id,
      name: s.name,
      state: s.state ?? null,
    })),
    serviceMilestones: milestones.map((m) => ({
      id: m.id,
      service_id: m.service_id,
      title: m.title,
      order_index: m.order_index ?? 0,
    })),
    counselors: (counselors ?? [])
      .map((c) => ({
      id: c.id as string,
      full_name: c.full_name as string,
      office_id: (c.office_id as string | null) ?? null,
      office_ids: [...(counselorOfficeIds.get(c.id as string) ?? [])],
    }))
      .sort((a, b) =>
        (a.full_name ?? "").localeCompare(b.full_name ?? "", undefined, { sensitivity: "base" })
      ),
    esUsers: (() => {
      const mapped = esProfiles
        .map((p) => {
          const id = p.id as string;
          const email = emailById.get(id) ?? "";
          const profile = profileById.get(id);
          return {
            id,
            email,
            full_name: profile?.full_name ?? null,
            display_name: staffNameFor(id),
            office_ids: staffOfficeByUser.get(id) ?? [],
          };
        })
        .sort((a, b) =>
          a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
        );

      if (scope?.supervisorUserId) {
        const supId = scope.supervisorUserId;
        if (!mapped.some((e) => e.id === supId)) {
          const profile = profileById.get(supId);
          mapped.unshift({
            id: supId,
            email: emailById.get(supId) ?? "",
            full_name: profile?.full_name ?? null,
            display_name: `${staffNameFor(supId)} (you)`,
            office_ids: staffOfficeByUser.get(supId) ?? [],
          });
        }
      }

      return mapped;
    })(),
    caseloadAssignees: (() => {
      let assigneeProfiles = (profiles ?? []).filter(
        (p) => p.role === "es" || p.role === "supervisor"
      );

      if (scope?.supervisorUserId) {
        const officeSet = new Set(scope.officeIds ?? []);
        const esSet = new Set(scope.esUserIds ?? []);
        esSet.add(scope.supervisorUserId);
        assigneeProfiles = assigneeProfiles.filter((p) => {
          const id = p.id as string;
          if (id === scope.supervisorUserId) return true;
          if (p.role === "supervisor") return false;
          return (
            esSet.has(id) ||
            (staffOfficeByUser.get(id) ?? []).some((officeId) => officeSet.has(officeId))
          );
        });
      }

      const mapped = assigneeProfiles
        .map((p) => {
          const id = p.id as string;
          const profile = profileById.get(id);
          const isSupervisor = p.role === "supervisor";
          const isActive = p.is_active !== false;
          const name = staffNameFor(id);
          const inactiveSuffix = isActive ? "" : " (inactive)";
          return {
            id,
            email: emailById.get(id) ?? "",
            full_name: profile?.full_name ?? null,
            display_name: isSupervisor ? `${name} (Supervisor)${inactiveSuffix}` : `${name}${inactiveSuffix}`,
            office_ids: staffOfficeByUser.get(id) ?? [],
            role: p.role as "es" | "supervisor",
            is_active: isActive,
          };
        })
        .sort((a, b) =>
          a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
        );

      if (scope?.supervisorUserId) {
        const supId = scope.supervisorUserId;
        if (!mapped.some((e) => e.id === supId)) {
          const profile = profileById.get(supId);
          const name = staffNameFor(supId);
          const isActive = profile?.is_active !== false;
          mapped.unshift({
            id: supId,
            email: emailById.get(supId) ?? "",
            full_name: profile?.full_name ?? null,
            display_name: `${name} (you)${isActive ? "" : " (inactive)"}`,
            office_ids: staffOfficeByUser.get(supId) ?? [],
            role: "supervisor",
            is_active: isActive,
          });
        }
      }

      return mapped;
    })(),
    esStaff: (scopedEsIds
      ? allEsProfiles.filter((p) => scopedEsIds.has(p.id as string))
      : allEsProfiles
    )
      .map((p) => {
        const id = p.id as string;
        const email = emailById.get(id) ?? "";
        const profile = profileById.get(id);
        return {
          id,
          email,
          full_name: profile?.full_name ?? null,
          display_name: staffNameFor(id),
          is_active: profile?.is_active !== false,
          office_ids: staffOfficeByUser.get(id) ?? [],
          client_count: esClientCountByUser.get(id) ?? 0,
        };
      })
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
      ),
    counselorStaff: (counselors ?? [])
      .map((c) => {
        const id = c.id as string;
        const loginId = (c as { user_id?: string | null }).user_id ?? null;
        const profile = loginId ? profileById.get(loginId) : undefined;
        return {
          id,
          full_name: c.full_name as string,
          email: loginId ? (emailById.get(loginId) ?? null) : null,
          user_id: loginId,
          has_login: Boolean(loginId),
          is_active: loginId ? profile?.is_active !== false : true,
          office_id: (c.office_id as string | null) ?? null,
          office_ids: [...(counselorOfficeIds.get(id) ?? [])],
          client_count: clientsForCounselor(id, loginId),
        };
      })
      .sort((a, b) =>
        a.full_name.localeCompare(b.full_name, undefined, { sensitivity: "base" })
      ),
    supervisorStaff: allSupervisorProfiles
      .map((p) => {
        const id = p.id as string;
        const profile = profileById.get(id);
        return {
          id,
          email: emailById.get(id) ?? "",
          full_name: profile?.full_name ?? null,
          display_name: staffNameFor(id),
          is_active: profile?.is_active !== false,
          office_ids: staffOfficeByUser.get(id) ?? [],
          es_count: esCountBySupervisor.get(id) ?? 0,
        };
      })
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
      ),
    supervisors: activeProfiles
      .filter((p) => p.role === "supervisor")
      .map((p) => {
        const id = p.id as string;
        return {
          id,
          email: emailById.get(id) ?? "",
          full_name: profileById.get(id)?.full_name ?? null,
          display_name: staffNameFor(id),
        };
      })
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
      ),
    admins: (profiles ?? [])
      .filter((p) => p.role === "admin" || p.role === "super_admin")
      .map((p) => {
        const id = p.id as string;
        const profile = profileById.get(id);
        return {
          id,
          email: emailById.get(id) ?? "",
          full_name: profile?.full_name ?? null,
          display_name: staffNameFor(id),
          role: p.role as "admin" | "super_admin",
          is_active: profile?.is_active !== false,
          is_protected: protectedIds.has(id),
        };
      })
      .sort((a, b) =>
        a.display_name.localeCompare(b.display_name, undefined, { sensitivity: "base" })
      ),
    staffNameById,
    clients: clientRows
      .map((c) => {
      const userId =
        (c.user_id as string | null) ?? (c as { profile_id?: string | null }).profile_id ?? null;
      const counselorId = c.counselor_id as string | null;
      const serviceId = c.current_service_id as string | null;
      const stageId = c.current_stage_id as string | null;
      return {
        id: c.id as string,
        contact_email: c.contact_email as string | null,
        office_id: c.office_id as string | null,
        es_user_ids: esClientByClient.get(c.id as string) ?? [],
        full_name:
          (c as { full_name?: string | null }).full_name ??
          (userId ? (profileNameById.get(userId) ?? null) : null),
        user_id: userId,
        current_service_id: serviceId,
        service_name: serviceId ? (serviceNameById.get(serviceId) ?? null) : null,
        current_stage_id: stageId,
        stage_title: stageId ? (stageTitleById.get(stageId) ?? null) : null,
        counselor_id: counselorId,
        counselor_name: counselorId ? (counselorNameById.get(counselorId) ?? null) : null,
        archived_at: (c as { archived_at?: string | null }).archived_at ?? null,
      };
    })
      .sort((a, b) =>
        clientDisplayName(a).localeCompare(clientDisplayName(b), undefined, { sensitivity: "base" })
      ),
    counselorOfficeLinks: counselorOfficeLinksOut,
    staffOfficeLinks: staffOfficeLinksOut,
    supervisorEsLinks: supervisorEsLinksOut,
    esClientLinks: esClientLinksOut,
  };
}

export type ActivityLogRow = {
  id: string;
  kind: "contact" | "application" | "stage" | "meeting";
  created_at: string;
  client_id: string;
  client_name: string | null;
  client_email: string | null;
  es_user_ids: string[];
  office_id: string | null;
  summary: string;
  detail: string | null;
};

function inDateRange(iso: string, from?: string, to?: string): boolean {
  if (!from && !to) return true;
  const day = iso.slice(0, 10);
  if (from && day < from) return false;
  if (to && day > to) return false;
  return true;
}

export async function loadActivityLogs(
  admin: ReturnType<typeof createServiceRoleClient>,
  filters: {
    esUserId?: string;
    clientId?: string;
    officeId?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
  },
  scope?: { officeIds?: string[]; esUserIds?: string[] }
): Promise<ActivityLogRow[]> {
  const limit = filters.limit ?? 500;

  let clientsQuery = await admin
    .from("clients")
    .select("id, contact_email, office_id, user_id, profile_id, full_name");
  if (clientsQuery.error) {
    clientsQuery = await admin
      .from("clients")
      .select("id, contact_email, office_id, user_id, profile_id");
    if (clientsQuery.error) {
      clientsQuery = await admin.from("clients").select("id, contact_email, office_id");
    }
  }

  const [{ data: esLinks }, { data: contacts }, { data: apps }, { data: stages }, { data: meetings }] =
    await Promise.all([
      admin.from("es_client_assignments").select("client_id, es_user_id"),
      admin
        .from("contact_logs")
        .select("id, client_id, created_at, public_outcome, notes, outcome")
        .order("created_at", { ascending: false })
        .limit(limit),
      admin
        .from("applications")
        .select("id, client_id, created_at, status, company_name, notes")
        .order("created_at", { ascending: false })
        .limit(limit),
      admin
        .from("client_stage_events")
        .select("id, client_id, created_at, service_milestones(title)")
        .order("created_at", { ascending: false })
        .limit(limit),
      admin
        .from("client_meeting_requests")
        .select("id, client_id, created_at, starts_at, location, status")
        .order("created_at", { ascending: false })
        .limit(limit),
    ]);

  const clientRows = clientsQuery.data ?? [];
  const authIds = [
    ...new Set(
      clientRows
        .flatMap((c) => [
          (c as { user_id?: string | null }).user_id,
          (c as { profile_id?: string | null }).profile_id,
        ])
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    ),
  ];

  const { data: clientProfiles } =
    authIds.length > 0
      ? await admin.from("profiles").select("id, full_name").in("id", authIds)
      : { data: [] as { id: string; full_name: string | null }[] };

  const profileNameById = new Map(
    (clientProfiles ?? []).map((p) => [p.id as string, p.full_name as string | null])
  );

  const clientMap = new Map<
    string,
    { email: string | null; office_id: string | null; name: string; canonicalId: string }
  >();
  const aliasToCanonical = new Map<string, string>();

  for (const c of clientRows) {
    const id = c.id as string;
    const userId =
      ((c as { user_id?: string | null }).user_id ??
        (c as { profile_id?: string | null }).profile_id) ??
      null;
    const label = clientDisplayName({
      full_name:
        (userId ? (profileNameById.get(userId) ?? null) : null) ??
        (c as { full_name?: string | null }).full_name ??
        null,
      contact_email: c.contact_email as string | null,
      id,
    });
    const entry = {
      email: c.contact_email as string | null,
      office_id: c.office_id as string | null,
      name: label,
      canonicalId: id,
    };
    for (const fk of buildClientActivityFkIds(c)) {
      clientMap.set(fk, entry);
      aliasToCanonical.set(fk, id);
    }
  }

  const esByClient = new Map<string, string[]>();
  for (const link of esLinks ?? []) {
    const cid = link.client_id as string;
    const canonicalId = aliasToCanonical.get(cid) ?? cid;
    const list = esByClient.get(canonicalId) ?? [];
    list.push(link.es_user_id as string);
    esByClient.set(canonicalId, list);
  }

  function inScope(rawClientId: string): boolean {
    const clientId = aliasToCanonical.get(rawClientId) ?? rawClientId;
    const client = clientMap.get(rawClientId) ?? clientMap.get(clientId);
    if (!client) return false;

    if (filters.clientId) {
      const filterCanonical = aliasToCanonical.get(filters.clientId) ?? filters.clientId;
      if (clientId !== filterCanonical) return false;
    }
    if (filters.officeId && client.office_id !== filters.officeId) return false;

    const esIds = esByClient.get(clientId) ?? [];
    if (filters.esUserId && !esIds.includes(filters.esUserId)) return false;

    if (scope?.officeIds?.length) {
      const officeOk =
        client.office_id && scope.officeIds.includes(client.office_id);
      const esOk = esIds.some((id) => scope.esUserIds?.includes(id));
      if (!officeOk && !esOk) return false;
    }

    return true;
  }

  const rows: ActivityLogRow[] = [];

  for (const log of contacts ?? []) {
    const clientId = log.client_id as string;
    if (!inScope(clientId)) continue;
    const createdAt = log.created_at as string;
    if (!inDateRange(createdAt, filters.dateFrom, filters.dateTo)) continue;
    const client = clientMap.get(clientId);
    const outcome =
      (log.public_outcome as string | null) ??
      (log.outcome as string | null) ??
      "";
    rows.push({
      id: log.id as string,
      kind: "contact",
      created_at: log.created_at as string,
      client_id: aliasToCanonical.get(clientId) ?? clientId,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      es_user_ids: esByClient.get(aliasToCanonical.get(clientId) ?? clientId) ?? [],
      office_id: client?.office_id ?? null,
      summary: outcome || "Contact log",
      detail: (log.notes as string | null) ?? null,
    });
  }

  for (const app of apps ?? []) {
    const clientId = app.client_id as string;
    if (!inScope(clientId)) continue;
    const createdAt = app.created_at as string;
    if (!inDateRange(createdAt, filters.dateFrom, filters.dateTo)) continue;
    const client = clientMap.get(clientId);
    rows.push({
      id: app.id as string,
      kind: "application",
      created_at: app.created_at as string,
      client_id: aliasToCanonical.get(clientId) ?? clientId,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      es_user_ids: esByClient.get(aliasToCanonical.get(clientId) ?? clientId) ?? [],
      office_id: client?.office_id ?? null,
      summary: `${app.company_name ?? "Application"} · ${app.status ?? ""}`,
      detail: (app.notes as string | null) ?? null,
    });
  }

  for (const ev of stages ?? []) {
    const clientId = ev.client_id as string;
    if (!inScope(clientId)) continue;
    const createdAt = ev.created_at as string;
    if (!inDateRange(createdAt, filters.dateFrom, filters.dateTo)) continue;
    const client = clientMap.get(clientId);
    const embed = ev.service_milestones as { title?: string } | { title?: string }[] | null;
    const title = Array.isArray(embed) ? embed[0]?.title : embed?.title;
    rows.push({
      id: ev.id as string,
      kind: "stage",
      created_at: ev.created_at as string,
      client_id: aliasToCanonical.get(clientId) ?? clientId,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      es_user_ids: esByClient.get(aliasToCanonical.get(clientId) ?? clientId) ?? [],
      office_id: client?.office_id ?? null,
      summary: `Stage · ${title ?? "Milestone"}`,
      detail: null,
    });
  }

  for (const mtg of meetings ?? []) {
    const clientId = mtg.client_id as string;
    if (!inScope(clientId)) continue;
    const createdAt = mtg.created_at as string;
    if (!inDateRange(createdAt, filters.dateFrom, filters.dateTo)) continue;
    const client = clientMap.get(clientId);
    const startsAt = mtg.starts_at as string | null;
    const when = startsAt ? new Date(startsAt).toLocaleString("en-US") : "";
    rows.push({
      id: mtg.id as string,
      kind: "meeting",
      created_at: createdAt,
      client_id: aliasToCanonical.get(clientId) ?? clientId,
      client_name: client?.name ?? null,
      client_email: client?.email ?? null,
      es_user_ids: esByClient.get(aliasToCanonical.get(clientId) ?? clientId) ?? [],
      office_id: client?.office_id ?? null,
      summary: `Meeting ${mtg.status ?? "pending"}${when ? ` · ${when}` : ""}`,
      detail: (mtg.location as string | null) ?? null,
    });
  }

  rows.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return rows.slice(0, limit);
}

export function activityLogsToCsv(rows: ActivityLogRow[]): string {
  const header = [
    "created_at",
    "kind",
    "client_id",
    "client_name",
    "client_email",
    "office_id",
    "es_user_ids",
    "summary",
    "detail",
  ];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.created_at,
        r.kind,
        r.client_id,
        r.client_name ?? "",
        r.client_email ?? "",
        r.office_id ?? "",
        r.es_user_ids.join(";"),
        r.summary,
        r.detail ?? "",
      ]
        .map((v) => escape(String(v)))
        .join(",")
    ),
  ];
  return lines.join("\n");
}
