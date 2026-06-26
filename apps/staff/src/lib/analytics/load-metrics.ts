import { buildClientActivityFkIds } from "@wayfinder/supabase";
import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  filterOfficesForPicker,
  queryAllOffices,
} from "@/lib/office-visibility";
import type { AnalyticsScope } from "./access";
import {
  CLOSED_STAGE_PATTERN,
  daysBetween,
  INTAKE_STAGE_PATTERN,
  isHiredApplicationStatus,
  median,
  monthKey,
  parseDateRange,
} from "./definitions";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

type ClientRow = {
  id: string;
  user_id: string | null;
  profile_id: string | null;
  office_id: string | null;
  created_at: string;
  current_stage_id: string | null;
  is_demo?: boolean | null;
};

function excludeDemoClients(rows: ClientRow[]): ClientRow[] {
  return rows.filter((c) => !c.is_demo);
}

export type ClientFact = {
  clientId: string;
  officeId: string | null;
  esUserIds: string[];
  intakeAt: Date;
  hireAt: Date | null;
  isActive: boolean;
  currentStageTitle: string | null;
};

export type MonthlyMetricRow = {
  month: string;
  intakes: number;
  hires: number;
  hireRate: number | null;
};

export type AnalyticsSummary = {
  range: { from: string; to: string };
  activeCaseload: number;
  clientsHired: number;
  hireRate: number | null;
  medianDaysToHire: number | null;
  applicationsSubmitted: number;
  applicationsByStatus: { status: string; count: number }[];
  monthly: MonthlyMetricRow[];
  definitions: Record<string, string>;
};

export type AnalyticsFilterOptions = {
  offices: { id: string; name: string }[];
  esUsers: { id: string; name: string }[];
  canFilterByEs: boolean;
  canFilterByOffice: boolean;
};

export type LoadMetricsInput = {
  from?: string | null;
  to?: string | null;
  officeId?: string | null;
  esUserId?: string | null;
};

async function loadScopedClientRows(
  admin: AdminClient,
  scope: AnalyticsScope,
  filters: { officeId?: string | null; esUserId?: string | null }
): Promise<ClientRow[]> {
  const select = "id, user_id, profile_id, office_id, created_at, current_stage_id, is_demo";

  if (scope.kind === "es") {
    const { data: links } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", scope.esUserId);
    const clientIds = [...new Set((links ?? []).map((l) => l.client_id as string))];
    if (clientIds.length === 0) {
      return [];
    }
    const { data } = await admin.from("clients").select(select).in("id", clientIds);
    return excludeDemoClients(applyClientFilters(data ?? [], filters));
  }

  if (scope.kind === "supervisor") {
    const clientIdSet = new Set<string>();

    if (scope.esUserIds.length > 0) {
      const { data: links } = await admin
        .from("es_client_assignments")
        .select("client_id")
        .in("es_user_id", scope.esUserIds);
      for (const link of links ?? []) {
        clientIdSet.add(link.client_id as string);
      }
    }

    if (scope.officeIds.length > 0) {
      const { data: officeClients } = await admin
        .from("clients")
        .select("id")
        .in("office_id", scope.officeIds);
      for (const row of officeClients ?? []) {
        clientIdSet.add(row.id as string);
      }
    }

    if (clientIdSet.size === 0) {
      return [];
    }

    const { data } = await admin.from("clients").select(select).in("id", [...clientIdSet]);
    let rows = data ?? [];

    if (filters.esUserId) {
      const { data: esLinks } = await admin
        .from("es_client_assignments")
        .select("client_id")
        .eq("es_user_id", filters.esUserId);
      const allowed = new Set((esLinks ?? []).map((l) => l.client_id as string));
      rows = rows.filter((c) => allowed.has(c.id as string));
    }

    return excludeDemoClients(applyClientFilters(rows, filters));
  }

  let query = admin.from("clients").select(select).eq("is_demo", false).limit(10000);
  if (filters.officeId) {
    query = query.eq("office_id", filters.officeId);
  }
  const { data: allClients } = await query;
  let rows = allClients ?? [];

  if (filters.esUserId) {
    const { data: esLinks } = await admin
      .from("es_client_assignments")
      .select("client_id")
      .eq("es_user_id", filters.esUserId);
    const allowed = new Set((esLinks ?? []).map((l) => l.client_id as string));
    rows = rows.filter((c) => allowed.has(c.id as string));
  }

  return rows as ClientRow[];
}

function applyClientFilters(
  rows: ClientRow[],
  filters: { officeId?: string | null; esUserId?: string | null }
): ClientRow[] {
  let out = rows;
  if (filters.officeId) {
    out = out.filter((c) => c.office_id === filters.officeId);
  }
  return out;
}

async function loadIntakeMilestoneIds(admin: AdminClient): Promise<Set<string>> {
  const { data } = await admin.from("service_milestones").select("id, title");
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const title = (row.title as string | null) ?? "";
    if (INTAKE_STAGE_PATTERN.test(title)) {
      ids.add(row.id as string);
    }
  }
  return ids;
}

async function buildClientFacts(
  admin: AdminClient,
  clients: ClientRow[],
  intakeMilestoneIds: Set<string>
): Promise<ClientFact[]> {
  if (clients.length === 0) {
    return [];
  }

  const fkToClientId = new Map<string, string>();
  const allFkIds: string[] = [];

  for (const c of clients) {
    for (const fk of buildClientActivityFkIds(c)) {
      fkToClientId.set(fk, c.id);
      allFkIds.push(fk);
    }
  }
  const uniqueFkIds = [...new Set(allFkIds)];

  const stageIds = [
    ...new Set(clients.map((c) => c.current_stage_id).filter(Boolean) as string[]),
  ];

  const [
    { data: esLinks },
    { data: stageEvents },
    { data: meetings },
    { data: applications },
    { data: milestones },
  ] = await Promise.all([
    admin.from("es_client_assignments").select("client_id, es_user_id").in("client_id", clients.map((c) => c.id)),
    uniqueFkIds.length
      ? admin
          .from("client_stage_events")
          .select("client_id, milestone_id, created_at")
          .in("client_id", uniqueFkIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { client_id: string; milestone_id: string; created_at: string }[] }),
    uniqueFkIds.length
      ? admin
          .from("client_meeting_requests")
          .select("client_id, starts_at, status")
          .in("client_id", uniqueFkIds)
          .eq("status", "accepted")
          .order("starts_at", { ascending: true })
      : Promise.resolve({ data: [] as { client_id: string; starts_at: string; status: string }[] }),
    uniqueFkIds.length
      ? admin
          .from("applications")
          .select("client_id, status, created_at")
          .in("client_id", uniqueFkIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as { client_id: string; status: string; created_at: string }[] }),
    stageIds.length
      ? admin.from("service_milestones").select("id, title").in("id", stageIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
  ]);

  const stageTitleById = new Map((milestones ?? []).map((m) => [m.id as string, m.title as string]));

  const esByClient = new Map<string, string[]>();
  for (const link of esLinks ?? []) {
    const cid = link.client_id as string;
    const list = esByClient.get(cid) ?? [];
    list.push(link.es_user_id as string);
    esByClient.set(cid, list);
  }

  function resolveClientId(fkId: string): string | null {
    return fkToClientId.get(fkId) ?? null;
  }

  const intakeByClient = new Map<string, Date>();
  for (const ev of stageEvents ?? []) {
    const cid = resolveClientId(ev.client_id as string);
    if (!cid || !intakeMilestoneIds.has(ev.milestone_id as string)) {
      continue;
    }
    if (!intakeByClient.has(cid)) {
      intakeByClient.set(cid, new Date(ev.created_at as string));
    }
  }

  for (const meeting of meetings ?? []) {
    const cid = resolveClientId(meeting.client_id as string);
    if (!cid || intakeByClient.has(cid)) {
      continue;
    }
    intakeByClient.set(cid, new Date(meeting.starts_at as string));
  }

  const hireByClient = new Map<string, Date>();
  for (const app of applications ?? []) {
    if (!isHiredApplicationStatus(app.status as string)) {
      continue;
    }
    const cid = resolveClientId(app.client_id as string);
    if (!cid) {
      continue;
    }
    const at = new Date(app.created_at as string);
    const prev = hireByClient.get(cid);
    if (!prev || at < prev) {
      hireByClient.set(cid, at);
    }
  }

  return clients.map((c) => {
    const stageTitle = c.current_stage_id
      ? (stageTitleById.get(c.current_stage_id) ?? null)
      : null;
    const isActive = !stageTitle || !CLOSED_STAGE_PATTERN.test(stageTitle.trim());
    return {
      clientId: c.id,
      officeId: c.office_id,
      esUserIds: esByClient.get(c.id) ?? [],
      intakeAt: intakeByClient.get(c.id) ?? new Date(c.created_at),
      hireAt: hireByClient.get(c.id) ?? null,
      isActive,
      currentStageTitle: stageTitle,
    };
  });
}

function inRange(date: Date, from: Date, to: Date): boolean {
  return date >= from && date <= to;
}

export async function loadAnalyticsSummary(
  admin: AdminClient,
  scope: AnalyticsScope,
  input: LoadMetricsInput
): Promise<AnalyticsSummary> {
  const range = parseDateRange(input.from ?? null, input.to ?? null);
  const clients = await loadScopedClientRows(admin, scope, {
    officeId: input.officeId,
    esUserId: input.esUserId,
  });
  const intakeMilestoneIds = await loadIntakeMilestoneIds(admin);
  const facts = await buildClientFacts(admin, clients, intakeMilestoneIds);

  const activeCaseload = facts.filter((f) => f.isActive).length;
  const hiredInPeriod = facts.filter(
    (f) => f.hireAt && inRange(f.hireAt, range.from, range.to)
  );
  const clientsHired = hiredInPeriod.length;
  const hireRate =
    activeCaseload > 0 ? Math.round((clientsHired / activeCaseload) * 1000) / 10 : null;

  const daysToHire = hiredInPeriod
    .map((f) => daysBetween(f.intakeAt, f.hireAt!))
    .filter((d) => Number.isFinite(d));
  const medianDaysToHire = median(daysToHire);

  const allFkIds = [...new Set(clients.flatMap((c) => buildClientActivityFkIds(c)))];
  let applicationsSubmitted = 0;
  const statusCounts = new Map<string, number>();

  if (allFkIds.length > 0) {
    const { data: periodApps } = await admin
      .from("applications")
      .select("status, created_at")
      .in("client_id", allFkIds)
      .gte("created_at", range.from.toISOString())
      .lte("created_at", range.to.toISOString());

    for (const app of periodApps ?? []) {
      applicationsSubmitted += 1;
      const status = ((app.status as string | null) ?? "").trim() || "Unknown";
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }
  }

  const applicationsByStatus = [...statusCounts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);

  const monthlyMap = new Map<string, { intakes: number; hires: number }>();
  for (const f of facts) {
    if (inRange(f.intakeAt, range.from, range.to)) {
      const key = monthKey(f.intakeAt);
      const row = monthlyMap.get(key) ?? { intakes: 0, hires: 0 };
      row.intakes += 1;
      monthlyMap.set(key, row);
    }
    if (f.hireAt && inRange(f.hireAt, range.from, range.to)) {
      const key = monthKey(f.hireAt);
      const row = monthlyMap.get(key) ?? { intakes: 0, hires: 0 };
      row.hires += 1;
      monthlyMap.set(key, row);
    }
  }

  const monthly = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, row]) => ({
      month,
      intakes: row.intakes,
      hires: row.hires,
      hireRate: row.intakes > 0 ? Math.round((row.hires / row.intakes) * 1000) / 10 : null,
    }));

  return {
    range: { from: range.fromIso, to: range.toIso },
    activeCaseload,
    clientsHired,
    hireRate,
    medianDaysToHire,
    applicationsSubmitted,
    applicationsByStatus,
    monthly,
    definitions: {
      intakeDate:
        "Earliest Phase 1 / Intake milestone, else first accepted meeting, else enrollment date.",
      hireDate: "First application marked Hired.",
      clientsHired: "Distinct clients with first hire in the selected range.",
      hireRate: "Clients hired in period ÷ active assigned caseload.",
      medianDaysToHire: "Median days from intake to first hire (clients hired in period).",
      activeCaseload: "Assigned clients not in Closed or Dismissed stage.",
    },
  };
}

export async function loadAnalyticsFilterOptions(
  admin: AdminClient,
  scope: AnalyticsScope
): Promise<AnalyticsFilterOptions> {
  const clients = await loadScopedClientRows(admin, scope, {});
  const officeIds = [...new Set(clients.map((c) => c.office_id).filter(Boolean) as string[])];
  const clientIds = clients.map((c) => c.id);

  let esUserIds: string[] = [];
  if (scope.kind === "es") {
    esUserIds = [scope.esUserId];
  } else if (scope.kind === "supervisor") {
    esUserIds = scope.esUserIds;
  } else if (clientIds.length > 0) {
    const { data: links } = await admin
      .from("es_client_assignments")
      .select("es_user_id")
      .in("client_id", clientIds.slice(0, 5000));
    esUserIds = [...new Set((links ?? []).map((l) => l.es_user_id as string))];
  }

  let officeOptions: Array<{ id: string; name: string }> = [];
  if (officeIds.length) {
    const { data: offices } = await admin
      .from("offices")
      .select("id, name, is_hidden")
      .in("id", officeIds)
      .order("name");
    officeOptions = filterOfficesForPicker(
      (offices ?? []).map((office) => ({
        id: office.id as string,
        name: office.name as string,
        is_hidden: (office as { is_hidden?: boolean | null }).is_hidden,
      })),
      { alwaysIncludeIds: officeIds }
    ).map((office) => ({ id: office.id, name: office.name }));
  } else if (scope.kind === "org") {
    officeOptions = filterOfficesForPicker(await queryAllOffices(admin)).map((office) => ({
      id: office.id,
      name: office.name,
    }));
  }

  const [{ data: profiles }] = await Promise.all([
    esUserIds.length
      ? admin.from("profiles").select("id, full_name, email").in("id", esUserIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string | null }[] }),
  ]);

  return {
    offices: officeOptions,
    esUsers: (profiles ?? [])
      .map((p) => ({
        id: p.id as string,
        name: (p.full_name as string | null)?.trim() || (p.email as string | null) || p.id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    canFilterByEs: scope.kind !== "es",
    canFilterByOffice: scope.kind !== "es" || true,
  };
}

export async function loadAnalyticsExportRows(
  admin: AdminClient,
  scope: AnalyticsScope,
  input: LoadMetricsInput
): Promise<Record<string, string | number | null>[]> {
  const range = parseDateRange(input.from ?? null, input.to ?? null);
  const clients = await loadScopedClientRows(admin, scope, {
    officeId: input.officeId,
    esUserId: input.esUserId,
  });
  const intakeMilestoneIds = await loadIntakeMilestoneIds(admin);
  const facts = await buildClientFacts(admin, clients, intakeMilestoneIds);

  const officeIds = [...new Set(facts.map((f) => f.officeId).filter(Boolean) as string[])];
  const { data: offices } = officeIds.length
    ? await admin.from("offices").select("id, name").in("id", officeIds)
    : { data: [] as { id: string; name: string }[] };
  const officeName = new Map((offices ?? []).map((o) => [o.id as string, o.name as string]));

  const esIds = [...new Set(facts.flatMap((f) => f.esUserIds))];
  const { data: esProfiles } = esIds.length
    ? await admin.from("profiles").select("id, full_name").in("id", esIds)
    : { data: [] as { id: string; full_name: string | null }[] };
  const esName = new Map(
    (esProfiles ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? p.id])
  );

  return facts.map((f) => ({
    client_id: f.clientId,
    office: f.officeId ? (officeName.get(f.officeId) ?? "") : "",
    es_names: f.esUserIds.map((id) => esName.get(id) ?? id).join("; "),
    intake_date: f.intakeAt.toISOString().slice(0, 10),
    hire_date: f.hireAt ? f.hireAt.toISOString().slice(0, 10) : "",
    days_intake_to_hire: f.hireAt ? daysBetween(f.intakeAt, f.hireAt) : "",
    is_active: f.isActive ? "yes" : "no",
    current_stage: f.currentStageTitle ?? "",
    hired_in_period: f.hireAt && inRange(f.hireAt, range.from, range.to) ? "yes" : "no",
  }));
}

export function analyticsExportToCsv(rows: Record<string, string | number | null>[]): string {
  if (rows.length === 0) {
    return "client_id,office,es_names,intake_date,hire_date,days_intake_to_hire,is_active,current_stage,hired_in_period\n";
  }
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number | null) => {
    const s = String(v ?? "");
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ].join("\n");
}
