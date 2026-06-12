import type { SupabaseClient } from "@supabase/supabase-js";
import { createClientAccount } from "./client-create";
import {
  CLIENT_IMPORT_COLUMNS,
  type ClientImportInputRow,
} from "./client-import-csv";

export {
  CLIENT_IMPORT_COLUMNS,
  type ClientImportColumn,
  type ClientImportInputRow,
  parseClientImportCsv,
} from "./client-import-csv";

export type ClientImportLookupData = {
  officesByKey: Map<string, { id: string; name: string }>;
  servicesByKey: Map<string, { id: string; name: string }>;
  counselorsByKey: Map<string, { id: string; full_name: string; office_id: string }>;
  counselorOfficeIds: Map<string, Set<string>>;
  esByEmail: Map<string, { id: string; email: string; full_name: string | null }>;
};

export type ClientImportRowResult = {
  row: number;
  email: string;
  client_name: string;
  ok: boolean;
  clientId?: string;
  error?: string;
};

export type ClientImportBatchResult = {
  imported: number;
  failed: number;
  results: ClientImportRowResult[];
};

function parseYesNo(value: string | undefined, defaultValue: boolean): boolean {
  const v = (value ?? "").trim().toLowerCase();
  if (!v) return defaultValue;
  if (["yes", "y", "true", "1", "send"].includes(v)) return true;
  if (["no", "n", "false", "0"].includes(v)) return false;
  return defaultValue;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

export async function loadClientImportLookups(
  admin: SupabaseClient
): Promise<ClientImportLookupData> {
  const [{ data: offices }, { data: services }, counselorsQuery, { data: esProfiles }, authUsers, { data: counselorOfficeLinks }] =
    await Promise.all([
      admin.from("offices").select("id, name").order("name"),
      admin.from("services").select("id, name").order("name"),
      admin.from("counselors").select("id, full_name, office_id, user_id").order("full_name"),
      admin.from("profiles").select("id, full_name").eq("role", "es"),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("counselor_office_assignments").select("counselor_id, office_id"),
    ]);

  const emailById = new Map(
    (authUsers.data.users ?? []).map((u) => [u.id, (u.email ?? "").trim().toLowerCase()])
  );

  let counselors: Array<{
    id: string;
    full_name: string;
    office_id: string;
    user_id?: string | null;
  }> = counselorsQuery.data ?? [];
  if (counselorsQuery.error?.message.includes("user_id")) {
    const fallback = await admin.from("counselors").select("id, full_name, office_id");
    counselors = fallback.data ?? [];
  } else if (counselorsQuery.error) {
    throw new Error(counselorsQuery.error.message);
  }

  const officesByKey = new Map<string, { id: string; name: string }>();
  for (const o of offices ?? []) {
    const entry = { id: o.id as string, name: o.name as string };
    officesByKey.set(normKey(entry.name), entry);
    officesByKey.set(normKey(entry.id), entry);
  }

  const servicesByKey = new Map<string, { id: string; name: string }>();
  for (const s of services ?? []) {
    const entry = { id: s.id as string, name: s.name as string };
    servicesByKey.set(normKey(entry.name), entry);
    servicesByKey.set(normKey(entry.id), entry);
  }

  const counselorsByKey = new Map<
    string,
    { id: string; full_name: string; office_id: string }
  >();
  for (const c of counselors) {
    const entry = {
      id: c.id as string,
      full_name: c.full_name as string,
      office_id: c.office_id as string,
    };
    counselorsByKey.set(normKey(entry.full_name), entry);
    counselorsByKey.set(normKey(entry.id), entry);
    const loginEmail = c.user_id ? emailById.get(c.user_id as string) : undefined;
    if (loginEmail) {
      counselorsByKey.set(loginEmail, entry);
    }
  }

  const esByEmail = new Map<string, { id: string; email: string; full_name: string | null }>();
  for (const p of esProfiles ?? []) {
    const email = emailById.get(p.id as string) ?? "";
    if (!email) continue;
    esByEmail.set(email, {
      id: p.id as string,
      email,
      full_name: (p.full_name as string | null) ?? null,
    });
  }

  const counselorOfficeIds = new Map<string, Set<string>>();
  for (const c of counselors) {
    const id = c.id as string;
    const primary = c.office_id as string | null;
    if (primary) {
      const set = counselorOfficeIds.get(id) ?? new Set<string>();
      set.add(primary);
      counselorOfficeIds.set(id, set);
    }
  }
  for (const link of counselorOfficeLinks ?? []) {
    const cid = link.counselor_id as string;
    const oid = link.office_id as string;
    const set = counselorOfficeIds.get(cid) ?? new Set<string>();
    set.add(oid);
    counselorOfficeIds.set(cid, set);
  }

  return { officesByKey, servicesByKey, counselorsByKey, counselorOfficeIds, esByEmail };
}

function resolveImportRow(
  input: ClientImportInputRow,
  lookups: ClientImportLookupData
): { ok: true; resolved: ResolvedImportRow } | { ok: false; error: string } {
  const client_name = input.client_name.trim();
  const email = input.email.trim().toLowerCase();

  if (!client_name) return { ok: false, error: "client_name is required" };
  if (!email || !email.includes("@")) return { ok: false, error: "Valid email is required" };

  const office = lookups.officesByKey.get(normKey(input.office));
  if (!office) {
    return { ok: false, error: `Unknown office "${input.office}"` };
  }

  const service = lookups.servicesByKey.get(normKey(input.service));
  if (!service) {
    return { ok: false, error: `Unknown service "${input.service}"` };
  }

  const counselor = lookups.counselorsByKey.get(normKey(input.counselor));
  if (!counselor) {
    return { ok: false, error: `Unknown counselor "${input.counselor}"` };
  }
  const allowedOffices = lookups.counselorOfficeIds.get(counselor.id);
  if (!allowedOffices?.has(office.id)) {
    return {
      ok: false,
      error: `Counselor "${input.counselor}" is not assigned to office "${office.name}"`,
    };
  }

  let esUserId: string | undefined;
  const esEmail = input.es_email.trim().toLowerCase();
  if (esEmail) {
    const es = lookups.esByEmail.get(esEmail);
    if (!es) {
      return { ok: false, error: `Unknown ES email "${input.es_email}"` };
    }
    esUserId = es.id;
  }

  const sendInvite = parseYesNo(input.send_invite, false);

  return {
    ok: true,
    resolved: {
      client_name,
      email,
      officeId: office.id,
      serviceId: service.id,
      counselorId: counselor.id,
      esUserId,
      sendInvite,
    },
  };
}

type ResolvedImportRow = {
  client_name: string;
  email: string;
  officeId: string;
  serviceId: string;
  counselorId: string;
  esUserId?: string;
  sendInvite: boolean;
};

export async function importClientRows(
  admin: SupabaseClient,
  rows: ClientImportInputRow[],
  lookups: ClientImportLookupData,
  startRowNumber = 2
): Promise<ClientImportBatchResult> {
  const results: ClientImportRowResult[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const input = rows[i]!;
    const rowNum = startRowNumber + i;
    const resolved = resolveImportRow(input, lookups);

    if (!resolved.ok) {
      failed++;
      results.push({
        row: rowNum,
        email: input.email.trim().toLowerCase(),
        client_name: input.client_name.trim(),
        ok: false,
        error: resolved.error,
      });
      continue;
    }

    const r = resolved.resolved;
    const created = await createClientAccount(admin, {
      name: r.client_name,
      email: r.email,
      serviceId: r.serviceId,
      officeId: r.officeId,
      counselorId: r.counselorId,
      esUserId: r.esUserId,
      sendInvite: r.sendInvite,
    });

    if ("error" in created) {
      failed++;
      results.push({
        row: rowNum,
        email: r.email,
        client_name: r.client_name,
        ok: false,
        error: created.error,
      });
      continue;
    }

    imported++;
    results.push({
      row: rowNum,
      email: r.email,
      client_name: r.client_name,
      ok: true,
      clientId: created.clientId,
    });
  }

  return { imported, failed, results };
}

export function buildClientImportTemplateCsv(lookups: ClientImportLookupData): string {
  const exampleOffice = [...lookups.officesByKey.values()][0]?.name ?? "Main Office";
  const exampleService = [...lookups.servicesByKey.values()][0]?.name ?? "Supported Employment";
  const exampleCounselor = [...lookups.counselorsByKey.values()][0]?.full_name ?? "Jane Counselor";
  const exampleEs = [...lookups.esByEmail.values()][0]?.email ?? "";

  const header = CLIENT_IMPORT_COLUMNS.join(",");
  const example = [
    "Jane Example",
    "jane.example@email.com",
    exampleOffice,
    exampleService,
    exampleCounselor,
    exampleEs,
    "no",
  ]
    .map(csvEscape)
    .join(",");

  const referenceLines = [
    "",
    "# Reference — valid offices (use exact name in office column)",
    ...( [...lookups.officesByKey.values()]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .map((o) => `# office: ${o.name}`) ),
    "# Reference — valid services",
    ...( [...lookups.servicesByKey.values()]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .map((s) => `# service: ${s.name}`) ),
    "# Reference — valid counselors (name or email)",
    ...( [...lookups.counselorsByKey.values()]
      .filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i)
      .map((c) => `# counselor: ${c.full_name}`) ),
    "# Reference — ES staff emails (optional es_email column)",
    ...( [...lookups.esByEmail.values()].map((e) => `# es_email: ${e.email}`) ),
    "# send_invite: yes sends magic-link email; no creates account silently (recommended for bulk load)",
  ];

  return [header, example, ...referenceLines].join("\n");
}

export function buildClientImportReference(lookups: ClientImportLookupData) {
  const unique = <T extends { id: string }>(items: T[]) =>
    items.filter((v, i, arr) => arr.findIndex((x) => x.id === v.id) === i);

  return {
    offices: unique([...lookups.officesByKey.values()]).map((o) => o.name),
    services: unique([...lookups.servicesByKey.values()]).map((s) => s.name),
    counselors: unique([...lookups.counselorsByKey.values()]).map((c) => c.full_name),
    esEmails: [...lookups.esByEmail.values()].map((e) => e.email),
  };
}
