import { clientDisplayName, serviceDisplayName } from "@wayfinder/branding";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ApplicationExportRow = {
  application_id: string;
  client_id: string;
  client_name: string;
  contact_email: string;
  office: string;
  company_name: string;
  status: string;
  status_other_reason: string;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type CaseloadExportRow = {
  client_id: string;
  client_name: string;
  contact_email: string;
  service: string;
  stage: string;
  office: string;
  counselor: string;
};

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function applicationsToCsv(rows: ApplicationExportRow[]): string {
  const header = [
    "application_id",
    "client_id",
    "client_name",
    "contact_email",
    "office",
    "company_name",
    "status",
    "status_other_reason",
    "notes",
    "created_at",
    "updated_at",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.application_id,
        row.client_id,
        row.client_name,
        row.contact_email,
        row.office,
        row.company_name,
        row.status,
        row.status_other_reason,
        row.notes,
        row.created_at,
        row.updated_at,
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export function caseloadToCsv(rows: CaseloadExportRow[]): string {
  const header = [
    "client_id",
    "client_name",
    "contact_email",
    "service",
    "stage",
    "office",
    "counselor",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) =>
      [
        row.client_id,
        row.client_name,
        row.contact_email,
        row.service,
        row.stage,
        row.office,
        row.counselor,
      ]
        .map((v) => csvEscape(String(v)))
        .join(",")
    ),
  ];
  return lines.join("\n");
}

export async function loadApplicationsExportRows(
  supabase: SupabaseClient,
  filters?: { clientId?: string }
): Promise<ApplicationExportRow[]> {
  let query = supabase
    .from("applications")
    .select(
      "id, client_id, status, status_other_reason, company_name, notes, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  if (filters?.clientId) {
    query = query.eq("client_id", filters.clientId);
  }

  const { data: apps, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  if (!apps?.length) {
    return [];
  }

  const clientIds = [...new Set(apps.map((a) => a.client_id as string))];
  const { data: clients } = await supabase
    .from("clients")
    .select("id, contact_email, user_id, office_id")
    .in("id", clientIds);

  const clientRows = clients ?? [];
  const userIds = [...new Set(clientRows.map((c) => c.user_id as string).filter(Boolean))];
  const officeIds = [...new Set(clientRows.map((c) => c.office_id as string).filter(Boolean))];

  const [{ data: profiles }, { data: offices }] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    officeIds.length
      ? supabase.from("offices").select("id, name").in("id", officeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const officeName = new Map((offices ?? []).map((o) => [o.id, o.name]));
  const clientById = new Map(
    clientRows.map((c) => {
      const id = c.id as string;
      const userId = c.user_id as string | null;
      return [
        id,
        {
          name: clientDisplayName({
            id,
            full_name: userId ? (profileName.get(userId) ?? null) : null,
            contact_email: (c.contact_email as string | null) ?? null,
          }),
          email: (c.contact_email as string | null) ?? "",
          office: c.office_id ? (officeName.get(c.office_id as string) ?? "") : "",
        },
      ];
    })
  );

  return apps.map((app) => {
    const clientId = app.client_id as string;
    const client = clientById.get(clientId);
    return {
      application_id: app.id as string,
      client_id: clientId,
      client_name: client?.name ?? clientId,
      contact_email: client?.email ?? "",
      office: client?.office ?? "",
      company_name: (app.company_name as string | null) ?? "",
      status: (app.status as string | null) ?? "",
      status_other_reason: (app.status_other_reason as string | null) ?? "",
      notes: (app.notes as string | null) ?? "",
      created_at: app.created_at as string,
      updated_at: (app.updated_at as string | null) ?? (app.created_at as string),
    };
  });
}

export async function loadEsCaseloadRows(
  supabase: SupabaseClient,
  esUserId: string
): Promise<CaseloadExportRow[]> {
  const { data: links } = await supabase
    .from("es_client_assignments")
    .select("client_id")
    .eq("es_user_id", esUserId);

  const clientIds = (links ?? []).map((l) => l.client_id as string).filter(Boolean);
  if (clientIds.length === 0) {
    return [];
  }

  const { data: clients } = await supabase
    .from("clients")
    .select(
      "id, user_id, contact_email, current_service_id, current_stage_id, office_id, counselor_id"
    )
    .in("id", clientIds);

  const rows = clients ?? [];
  const userIds = [...new Set(rows.map((c) => c.user_id as string).filter(Boolean))];
  const serviceIds = [
    ...new Set(rows.map((c) => c.current_service_id as string).filter(Boolean)),
  ];
  const stageIds = [...new Set(rows.map((c) => c.current_stage_id as string).filter(Boolean))];
  const officeIds = [...new Set(rows.map((c) => c.office_id as string).filter(Boolean))];
  const counselorIds = [...new Set(rows.map((c) => c.counselor_id as string).filter(Boolean))];

  const [
    { data: profiles },
    serviceQuery,
    { data: stages },
    { data: offices },
    { data: counselors },
  ] = await Promise.all([
    userIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
    serviceIds.length
      ? supabase.from("services").select("id, name, state").in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: string; name: string; state?: string | null }[] }),
    stageIds.length
      ? supabase.from("service_milestones").select("id, title").in("id", stageIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    officeIds.length
      ? supabase.from("offices").select("id, name").in("id", officeIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    counselorIds.length
      ? supabase.from("counselors").select("id, full_name").in("id", counselorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
  ]);

  let serviceRows = (serviceQuery.data ?? []) as Array<{
    id: string;
    name: string;
    state?: string | null;
  }>;
  if (
    "error" in serviceQuery &&
    serviceQuery.error?.message.includes("state") &&
    serviceIds.length > 0
  ) {
    const fallback = await supabase.from("services").select("id, name").in("id", serviceIds);
    serviceRows = (fallback.data ?? []) as Array<{ id: string; name: string; state?: string | null }>;
  }

  const profileName = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
  const serviceName = new Map(
    serviceRows.map((s) => [
      s.id,
      serviceDisplayName({ id: s.id, name: s.name, state: s.state ?? null }),
    ])
  );
  const stageTitle = new Map((stages ?? []).map((m) => [m.id, m.title]));
  const officeName = new Map((offices ?? []).map((o) => [o.id, o.name]));
  const counselorName = new Map((counselors ?? []).map((c) => [c.id, c.full_name]));

  return rows
    .map((c) => {
      const id = c.id as string;
      const userId = c.user_id as string | null;
      return {
        client_id: id,
        client_name: clientDisplayName({
          id,
          full_name: userId ? (profileName.get(userId) ?? null) : null,
          contact_email: (c.contact_email as string | null) ?? null,
        }),
        contact_email: (c.contact_email as string | null) ?? "",
        service: c.current_service_id
          ? (serviceName.get(c.current_service_id as string) ?? "")
          : "",
        stage: c.current_stage_id ? (stageTitle.get(c.current_stage_id as string) ?? "") : "",
        office: c.office_id ? (officeName.get(c.office_id as string) ?? "") : "",
        counselor: c.counselor_id ? (counselorName.get(c.counselor_id as string) ?? "") : "",
      };
    })
    .sort((a, b) => a.client_name.localeCompare(b.client_name, undefined, { sensitivity: "base" }));
}
