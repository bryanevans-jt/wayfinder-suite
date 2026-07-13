import { clientDisplayName } from "@wayfinder/branding";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";

type Admin = ReturnType<typeof createServiceRoleClient>;

export type HrClientRow = {
  id: string;
  name: string;
  email: string | null;
  officeId: string | null;
  officeName: string | null;
  state: string | null;
  esNames: string;
  esUserIds: string[];
  serviceName: string | null;
  stageTitle: string | null;
  createdAt: string | null;
  jobStartDate: string | null;
};

export type HrAssignmentLink = {
  id: string;
  label: string;
};

export async function loadHrRegistry(
  admin: Admin,
  filters: {
    officeId?: string;
    esUserId?: string;
    clientId?: string;
    state?: string;
    dateFrom?: string;
    dateTo?: string;
  } = {}
): Promise<{
  clients: HrClientRow[];
  offices: { id: string; name: string; state: string | null }[];
  esUsers: { id: string; name: string }[];
  states: string[];
  supervisorEsLinks: HrAssignmentLink[];
  esClientLinks: HrAssignmentLink[];
  staffOfficeLinks: HrAssignmentLink[];
}> {
  const [
    { data: offices },
    { data: esProfiles },
    { data: clients },
    { data: esLinks },
    { data: staffOffice },
    { data: supervisorEs },
    { data: services },
    { data: milestones },
  ] = await Promise.all([
    admin.from("offices").select("id, name, state").order("name"),
    admin.from("profiles").select("id, full_name, email, is_active").eq("role", "es"),
    admin
      .from("clients")
      .select(
        "id, full_name, contact_email, office_id, current_service_id, current_stage_id, created_at, job_start_date, user_id, profile_id"
      )
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(5000),
    admin.from("es_client_assignments").select("id, es_user_id, client_id"),
    admin.from("staff_office_assignments").select("id, user_id, office_id"),
    admin.from("supervisor_es_assignments").select("id, supervisor_user_id, es_user_id"),
    admin.from("services").select("id, name"),
    admin.from("service_milestones").select("id, title"),
  ]);

  const officeById = new Map(
    (offices ?? []).map((o) => [
      o.id as string,
      { name: o.name as string, state: (o.state as string | null) ?? null },
    ])
  );

  const serviceById = new Map((services ?? []).map((s) => [s.id as string, s.name as string]));
  const stageById = new Map((milestones ?? []).map((m) => [m.id as string, m.title as string]));

  const authIds = [
    ...new Set(
      (clients ?? [])
        .flatMap((c) => [c.user_id as string | null, c.profile_id as string | null])
        .filter((v): v is string => Boolean(v))
    ),
  ];
  const staffIds = [
    ...new Set([
      ...(esProfiles ?? []).map((p) => p.id as string),
      ...(supervisorEs ?? []).flatMap((l) => [
        l.supervisor_user_id as string,
        l.es_user_id as string,
      ]),
      ...(staffOffice ?? []).map((l) => l.user_id as string),
    ]),
  ];

  const { data: nameProfiles } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", [...new Set([...authIds, ...staffIds])].slice(0, 2000));

  const nameById = new Map(
    (nameProfiles ?? []).map((p) => [
      p.id as string,
      (p.full_name as string | null)?.trim() ||
        (p.email as string | null)?.trim() ||
        "User",
    ])
  );

  const esByClient = new Map<string, string[]>();
  for (const link of esLinks ?? []) {
    const cid = link.client_id as string;
    const list = esByClient.get(cid) ?? [];
    list.push(link.es_user_id as string);
    esByClient.set(cid, list);
  }

  let rows: HrClientRow[] = (clients ?? []).map((c) => {
    const id = c.id as string;
    const officeId = (c.office_id as string | null) ?? null;
    const office = officeId ? officeById.get(officeId) : null;
    const authId = ((c.user_id as string | null) ?? (c.profile_id as string | null)) ?? null;
    const esIds = esByClient.get(id) ?? [];
    return {
      id,
      name: clientDisplayName({
        full_name:
          (authId ? nameById.get(authId) ?? null : null) ??
          ((c.full_name as string | null) ?? null),
        contact_email: c.contact_email as string | null,
        id,
      }),
      email: (c.contact_email as string | null) ?? null,
      officeId,
      officeName: office?.name ?? null,
      state: office?.state ?? null,
      esUserIds: esIds,
      esNames: esIds.map((eid) => nameById.get(eid) ?? eid.slice(0, 8)).join(", ") || "—",
      serviceName: c.current_service_id
        ? (serviceById.get(c.current_service_id as string) ?? null)
        : null,
      stageTitle: c.current_stage_id
        ? (stageById.get(c.current_stage_id as string) ?? null)
        : null,
      createdAt: (c.created_at as string | null) ?? null,
      jobStartDate: (c.job_start_date as string | null) ?? null,
    };
  });

  if (filters.officeId) {
    rows = rows.filter((r) => r.officeId === filters.officeId);
  }
  if (filters.esUserId) {
    rows = rows.filter((r) => r.esUserIds.includes(filters.esUserId!));
  }
  if (filters.clientId) {
    rows = rows.filter((r) => r.id === filters.clientId);
  }
  if (filters.state) {
    rows = rows.filter((r) => (r.state ?? "").toUpperCase() === filters.state!.toUpperCase());
  }
  if (filters.dateFrom) {
    rows = rows.filter((r) => (r.createdAt ?? "") >= `${filters.dateFrom}T00:00:00`);
  }
  if (filters.dateTo) {
    rows = rows.filter((r) => (r.createdAt ?? "") <= `${filters.dateTo}T23:59:59.999Z`);
  }

  const esUsers = (esProfiles ?? [])
    .map((p) => ({
      id: p.id as string,
      name:
        (p.full_name as string | null)?.trim() ||
        (p.email as string | null)?.trim() ||
        "Employment Specialist",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const states = [
    ...new Set(
      (offices ?? [])
        .map((o) => (o.state as string | null)?.toUpperCase() ?? null)
        .filter((s): s is string => Boolean(s))
    ),
  ].sort();

  const clientNameById = new Map(rows.map((r) => [r.id, r.name]));
  // Rebuild client name map for assignment labels from unfiltered clients if needed
  for (const c of clients ?? []) {
    if (!clientNameById.has(c.id as string)) {
      clientNameById.set(
        c.id as string,
        clientDisplayName({
          full_name: (c.full_name as string | null) ?? null,
          contact_email: c.contact_email as string | null,
          id: c.id as string,
        })
      );
    }
  }

  return {
    clients: rows,
    offices: (offices ?? []).map((o) => ({
      id: o.id as string,
      name: o.name as string,
      state: (o.state as string | null) ?? null,
    })),
    esUsers,
    states,
    supervisorEsLinks: (supervisorEs ?? []).map((l) => ({
      id: l.id as string,
      label: `${nameById.get(l.supervisor_user_id as string) ?? "Supervisor"} → ${
        nameById.get(l.es_user_id as string) ?? "ES"
      }`,
    })),
    esClientLinks: (esLinks ?? []).map((l) => ({
      id: l.id as string,
      label: `${nameById.get(l.es_user_id as string) ?? "ES"} → ${
        clientNameById.get(l.client_id as string) ?? "Client"
      }`,
    })),
    staffOfficeLinks: (staffOffice ?? []).map((l) => ({
      id: l.id as string,
      label: `${nameById.get(l.user_id as string) ?? "Staff"} · ${
        officeById.get(l.office_id as string)?.name ?? "Office"
      }`,
    })),
  };
}
