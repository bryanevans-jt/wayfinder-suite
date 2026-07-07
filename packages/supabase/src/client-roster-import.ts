import type { SupabaseClient } from "@supabase/supabase-js";
import { insertRosterClientRecord } from "./client-roster-insert";
import {
  ROSTER_IMPORT_COLUMNS,
  type RosterImportInputRow,
} from "./client-roster-import-csv";

export {
  ROSTER_IMPORT_COLUMNS,
  type RosterImportColumn,
  type RosterImportInputRow,
  parseRosterImportCsv,
  analyzeRosterImportCsv,
} from "./client-roster-import-csv";

export const ROSTER_UNASSIGNED_OFFICE_NAME = "Unassigned (import)";

export type RosterImportLookupData = {
  counselorsByKey: Map<string, { id: string; full_name: string }>;
  caseloadAssigneeByEmail: Map<string, { id: string; email: string; full_name: string | null }>;
  unassignedOfficeId: string | null;
};

export type RosterImportRowResult = {
  row: number;
  client_name: string;
  ok: boolean;
  clientId?: string;
  error?: string;
};

export type RosterImportBatchResult = {
  imported: number;
  failed: number;
  results: RosterImportRowResult[];
};

function normKey(value: string): string {
  return value.trim().toLowerCase();
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function ensureRosterUnassignedOffice(
  admin: SupabaseClient
): Promise<{ id: string; created: boolean }> {
  const { data: existing } = await admin
    .from("offices")
    .select("id")
    .eq("name", ROSTER_UNASSIGNED_OFFICE_NAME)
    .maybeSingle();

  if (existing?.id) {
    return { id: existing.id as string, created: false };
  }

  const { data, error } = await admin
    .from("offices")
    .insert({ name: ROSTER_UNASSIGNED_OFFICE_NAME, state: "GA" })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Could not create Unassigned (import) office");
  }

  return { id: data.id as string, created: true };
}

export async function loadRosterImportLookups(
  admin: SupabaseClient
): Promise<RosterImportLookupData> {
  const [{ data: counselors }, { data: profiles }, authUsers, { data: offices }] =
    await Promise.all([
      admin.from("counselors").select("id, full_name").order("full_name"),
      admin
        .from("profiles")
        .select("id, full_name, role, is_active")
        .in("role", ["es", "supervisor"]),
      admin.auth.admin.listUsers({ perPage: 1000 }),
      admin.from("offices").select("id, name").eq("name", ROSTER_UNASSIGNED_OFFICE_NAME).maybeSingle(),
    ]);

  const emailById = new Map(
    (authUsers.data.users ?? []).map((u) => [u.id, (u.email ?? "").trim().toLowerCase()])
  );

  const counselorsByKey = new Map<string, { id: string; full_name: string }>();
  for (const c of counselors ?? []) {
    const entry = { id: c.id as string, full_name: c.full_name as string };
    counselorsByKey.set(normKey(entry.full_name), entry);
    counselorsByKey.set(normKey(entry.id), entry);
  }

  const caseloadAssigneeByEmail = new Map<
    string,
    { id: string; email: string; full_name: string | null }
  >();
  for (const p of profiles ?? []) {
    const email = emailById.get(p.id as string);
    if (!email) continue;
    caseloadAssigneeByEmail.set(email, {
      id: p.id as string,
      email,
      full_name: (p.full_name as string | null) ?? null,
    });
  }

  return {
    counselorsByKey,
    caseloadAssigneeByEmail,
    unassignedOfficeId: (offices?.id as string | undefined) ?? null,
  };
}

export function resolveRosterImportRow(
  input: RosterImportInputRow,
  lookups: RosterImportLookupData
): { ok: true; data: ResolvedRosterRow } | { ok: false; error: string } {
  const clientName = input.client_name.trim();
  if (!clientName) {
    return { ok: false, error: "client_name is required" };
  }

  let counselorId: string | null = null;
  const counselorKey = normKey(input.counselor);
  if (counselorKey) {
    const counselor = lookups.counselorsByKey.get(counselorKey);
    if (!counselor) {
      return {
        ok: false,
        error: `Unknown counselor "${input.counselor.trim()}". Run roster prep or add the counselor first.`,
      };
    }
    counselorId = counselor.id;
  }

  let esUserId: string | null = null;
  const esEmail = input.es_email.trim().toLowerCase();
  if (esEmail) {
    const es = lookups.caseloadAssigneeByEmail.get(esEmail);
    if (!es) {
      return {
        ok: false,
        error: `No ES/supervisor account found for email "${esEmail}".`,
      };
    }
    esUserId = es.id;
  }

  return {
    ok: true,
    data: {
      clientName,
      counselorId,
      esUserId,
      employmentGoal: input.employment_goal.trim() || null,
    },
  };
}

type ResolvedRosterRow = {
  clientName: string;
  counselorId: string | null;
  esUserId: string | null;
  employmentGoal: string | null;
};

async function findExistingRosterClient(
  admin: SupabaseClient,
  fullName: string
): Promise<string | null> {
  const { data } = await admin
    .from("clients")
    .select("id, full_name")
    .is("user_id", null)
    .not("full_name", "is", null);

  const key = normKey(fullName);
  for (const row of data ?? []) {
    if (normKey((row.full_name as string) ?? "") === key) {
      return row.id as string;
    }
  }
  return null;
}

export async function importRosterClientBatch(
  admin: SupabaseClient,
  rows: RosterImportInputRow[],
  options: { startRow?: number } = {}
): Promise<RosterImportBatchResult> {
  const lookups = await loadRosterImportLookups(admin);
  const startRow = options.startRow ?? 2;
  const results: RosterImportRowResult[] = [];
  let imported = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const rowNum = startRow + i;
    const input = rows[i];
    const resolved = resolveRosterImportRow(input, lookups);
    if (!resolved.ok) {
      failed++;
      results.push({
        row: rowNum,
        client_name: input.client_name,
        ok: false,
        error: resolved.error,
      });
      continue;
    }

    const { clientName, counselorId, esUserId, employmentGoal } = resolved.data;

    const existingId = await findExistingRosterClient(admin, clientName);
    if (existingId) {
      imported++;
      results.push({
        row: rowNum,
        client_name: clientName,
        ok: true,
        clientId: existingId,
      });
      continue;
    }

    const created = await insertRosterClientRecord(admin, {
      fullName: clientName,
      counselorId,
      employmentGoalPrimary: employmentGoal,
    });

    if ("error" in created) {
      failed++;
      results.push({
        row: rowNum,
        client_name: clientName,
        ok: false,
        error: created.error,
      });
      continue;
    }

    if (esUserId) {
      const { error: assignErr } = await admin.from("es_client_assignments").insert({
        es_user_id: esUserId,
        client_id: created.id,
      });
      if (assignErr) {
        await admin.from("clients").delete().eq("id", created.id);
        failed++;
        results.push({
          row: rowNum,
          client_name: clientName,
          ok: false,
          error: assignErr.message,
        });
        continue;
      }
    }

    imported++;
    results.push({
      row: rowNum,
      client_name: clientName,
      ok: true,
      clientId: created.id,
    });
  }

  return { imported, failed, results };
}

export function buildRosterImportTemplateCsv(lookups: RosterImportLookupData): string {
  const exampleCounselor = [...lookups.counselorsByKey.values()][0]?.full_name ?? "Counselor Name";
  const exampleEs = [...lookups.caseloadAssigneeByEmail.values()][0]?.email ?? "es@thejoshuatree.org";
  const header = ROSTER_IMPORT_COLUMNS.join(",");
  const example = [
    "Jane Example",
    exampleCounselor,
    exampleEs,
    "Customer service",
  ]
    .map(csvEscape)
    .join(",");
  return `${header}\n${example}\n`;
}

export function buildRosterImportReference(lookups: RosterImportLookupData): {
  counselors: string[];
  esEmails: string[];
} {
  const counselors = [...new Set([...lookups.counselorsByKey.values()].map((c) => c.full_name))].sort(
    (a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const esEmails = [...lookups.caseloadAssigneeByEmail.keys()].sort();
  return { counselors, esEmails };
}
