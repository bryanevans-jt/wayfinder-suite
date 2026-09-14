import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingSchemaError, isMissingTableError } from "./schema-fallback";
import { loadPreEtsSettings } from "./pre-ets-settings";
import { expandSchoolAbbreviation, pickBestSchoolNameMatch } from "./pre-ets-school-name-match";

export const PRE_ETS_CLASS_SETUP_MIGRATION = "20260909160000_pre_ets_class_setup.sql";

export const PRE_ETS_CLASS_SETUP_SCHEMA_MESSAGE =
  "Pre-ETS class setup is not available in the database yet. Apply the Supabase migration " +
  `${PRE_ETS_CLASS_SETUP_MIGRATION} (or run \`supabase db push\`) and reload this page.`;

let classSetupSchemaAvailable: boolean | null = null;

/** True when pre_ets_class_setup exists. Cached for the process lifetime. */
export async function isPreEtsClassSetupSchemaAvailable(
  admin: SupabaseClient
): Promise<boolean> {
  if (classSetupSchemaAvailable !== null) {
    return classSetupSchemaAvailable;
  }

  const { error } = await admin.from("pre_ets_class_setup").select("id").limit(0);
  if (error && (isMissingSchemaError(error.message) || isMissingTableError(error.message))) {
    classSetupSchemaAvailable = false;
    return false;
  }

  classSetupSchemaAvailable = !error;
  return classSetupSchemaAvailable;
}

export type SchoolNameResolutionWarning = {
  worksheetSchoolName: string;
  resolvedSchoolName: string;
  source: "worksheet" | "setup" | "existing";
  ambiguousCandidates?: string[];
};

export type PreEtsClassSetupRow = {
  id: string;
  school_year: string;
  regional_supervisor_user_id: string | null;
  regional_supervisor_name: string | null;
  school_name: string;
  school_id: string | null;
  district_number: string | null;
  transition_specialist_user_id: string | null;
  transition_specialist_name: string | null;
  class_days: string | null;
  class_time: string | null;
  frequency: string | null;
  service_code: string | null;
  notes: string | null;
  linked_program_group_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ClassSetupInput = {
  regionalSupervisorUserId?: string | null;
  regionalSupervisorName?: string | null;
  schoolName: string;
  schoolId?: string | null;
  districtNumber?: string | null;
  transitionSpecialistUserId?: string | null;
  transitionSpecialistName?: string | null;
  classDays?: string | null;
  classTime?: string | null;
  frequency?: string | null;
  serviceCode?: string | null;
  notes?: string | null;
};

export type BulkClassSetupRow = ClassSetupInput;

function normalizeSchoolName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

function normalizeLookup(value: string): string {
  return value.trim().toLowerCase();
}

async function resolveStaffUserId(
  admin: SupabaseClient,
  label: string | null | undefined,
  roles: string[]
): Promise<{ userId: string | null; displayName: string | null }> {
  const raw = (label ?? "").trim();
  if (!raw) return { userId: null, displayName: null };

  if (raw.includes("@")) {
    const email = raw.toLowerCase();
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match = users.users.find((u) => u.email?.toLowerCase() === email);
    if (match) {
      const { data: profile } = await admin
        .from("profiles")
        .select("id, full_name, role, is_active")
        .eq("id", match.id)
        .maybeSingle();
      if (profile?.is_active !== false && roles.includes(String(profile?.role ?? ""))) {
        return {
          userId: profile?.id as string,
          displayName: (profile?.full_name as string | null) ?? raw,
        };
      }
    }
    return { userId: null, displayName: raw };
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("is_active", true)
    .in("role", roles);

  const target = normalizeLookup(raw);
  const exact = (profiles ?? []).filter((p) => normalizeLookup(String(p.full_name ?? "")) === target);
  const pick = exact[0] ?? (profiles ?? []).find((p) =>
    normalizeLookup(String(p.full_name ?? "")).includes(target)
  );
  if (pick && roles.includes(String(pick.role ?? ""))) {
    return { userId: pick.id as string, displayName: (pick.full_name as string | null) ?? raw };
  }
  return { userId: null, displayName: raw };
}

export async function listPreEtsClassSetup(
  admin: SupabaseClient,
  schoolYear?: string
): Promise<PreEtsClassSetupRow[]> {
  if (!(await isPreEtsClassSetupSchemaAvailable(admin))) {
    return [];
  }

  const settings = await loadPreEtsSettings(admin);
  const year = schoolYear?.trim() || settings.school_year;

  const { data, error } = await admin
    .from("pre_ets_class_setup")
    .select("*")
    .eq("school_year", year)
    .order("regional_supervisor_name", { ascending: true })
    .order("school_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PreEtsClassSetupRow[];
}

export async function upsertPreEtsClassSetupEntry(
  admin: SupabaseClient,
  input: ClassSetupInput & { id?: string },
  actorUserId: string
): Promise<PreEtsClassSetupRow> {
  if (!(await isPreEtsClassSetupSchemaAvailable(admin))) {
    throw new Error(PRE_ETS_CLASS_SETUP_SCHEMA_MESSAGE);
  }

  const settings = await loadPreEtsSettings(admin);
  const schoolName = normalizeSchoolName(input.schoolName);
  if (!schoolName) {
    throw new Error("School name is required");
  }

  const supervisor = await resolveStaffUserId(admin, input.regionalSupervisorName ?? null, [
    "supervisor",
    "gvra_supervisor",
    "admin",
    "super_admin",
  ]);
  const ts = await resolveStaffUserId(admin, input.transitionSpecialistName ?? null, [
    "transition_specialist",
    "instructor",
    "es",
  ]);

  const patch = {
    school_year: settings.school_year,
    regional_supervisor_user_id: input.regionalSupervisorUserId ?? supervisor.userId,
    regional_supervisor_name:
      input.regionalSupervisorName?.trim() || supervisor.displayName || null,
    school_name: schoolName,
    school_id: input.schoolId ?? null,
    district_number: input.districtNumber?.trim() || null,
    transition_specialist_user_id: input.transitionSpecialistUserId ?? ts.userId,
    transition_specialist_name:
      input.transitionSpecialistName?.trim() || ts.displayName || null,
    class_days: input.classDays?.trim() || null,
    class_time: input.classTime?.trim() || null,
    frequency: input.frequency?.trim() || null,
    service_code: input.serviceCode?.trim() || null,
    notes: input.notes?.trim() || null,
    updated_at: new Date().toISOString(),
    updated_by: actorUserId,
  };

  let targetId = input.id;
  if (!targetId) {
    let existingQuery = admin
      .from("pre_ets_class_setup")
      .select("id")
      .eq("school_year", settings.school_year)
      .eq("school_name", schoolName);
    if (patch.district_number) {
      existingQuery = existingQuery.eq("district_number", patch.district_number);
    } else {
      existingQuery = existingQuery.is("district_number", null);
    }
    const { data: existing } = await existingQuery.maybeSingle();
    targetId = existing?.id as string | undefined;
  }

  let saved: PreEtsClassSetupRow;
  if (targetId) {
    const { data, error } = await admin
      .from("pre_ets_class_setup")
      .update(patch)
      .eq("id", targetId)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Update failed");
    saved = data as PreEtsClassSetupRow;
  } else {
    const { data, error } = await admin
      .from("pre_ets_class_setup")
      .insert(patch)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Insert failed");
    saved = data as PreEtsClassSetupRow;
  }

  if (saved.district_number?.trim() && !saved.school_id) {
    await ensurePreEtsSchoolForClassSetupRow(admin, saved.id, settings.school_year);
    const { data: refreshed } = await admin
      .from("pre_ets_class_setup")
      .select("*")
      .eq("id", saved.id)
      .maybeSingle();
    if (refreshed) saved = refreshed as PreEtsClassSetupRow;
  }

  return saved;
}

export async function deletePreEtsClassSetupEntry(
  admin: SupabaseClient,
  id: string
): Promise<void> {
  const { error } = await admin.from("pre_ets_class_setup").delete().eq("id", id);
  if (error) throw error;
}

export async function bulkImportPreEtsClassSetup(
  admin: SupabaseClient,
  rows: BulkClassSetupRow[],
  actorUserId: string
): Promise<{ imported: number; errors: string[] }> {
  let imported = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      if (!row.schoolName?.trim()) {
        errors.push(`Row ${i + 1}: school name is required`);
        continue;
      }
      await upsertPreEtsClassSetupEntry(admin, row, actorUserId);
      imported++;
    } catch (err) {
      errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : "Import failed"}`);
    }
  }

  return { imported, errors };
}

export type WorksheetSchoolNameResolution = {
  resolvedName: string;
  warning: SchoolNameResolutionWarning | null;
};

/** Match a worksheet school header to class setup or existing district schools. */
export async function resolveWorksheetSchoolName(
  admin: SupabaseClient,
  input: {
    districtId: string;
    schoolYear: string;
    districtNumber?: string | null;
    worksheetSchoolName: string;
  }
): Promise<WorksheetSchoolNameResolution> {
  const worksheetSchoolName = normalizeSchoolName(input.worksheetSchoolName);
  const expanded = expandSchoolAbbreviation(worksheetSchoolName);

  const { data: existingSchools } = await admin
    .from("pre_ets_schools")
    .select("id, name")
    .eq("district_id", input.districtId);

  const settings = await loadPreEtsSettings(admin);
  const year = input.schoolYear.trim() || settings.school_year;

  let setupRows: Array<{ id: string; school_name: string; school_id: string | null }> = [];
  if (await isPreEtsClassSetupSchemaAvailable(admin)) {
    let setupQuery = admin
      .from("pre_ets_class_setup")
      .select("id, school_name, school_id")
      .eq("school_year", year);

    if (input.districtNumber?.trim()) {
      setupQuery = setupQuery.eq("district_number", input.districtNumber.trim());
    }

    const { data, error } = await setupQuery;
    if (!error) setupRows = (data ?? []) as typeof setupRows;
  }

  const candidates: Array<{ name: string; source: "setup" | "existing"; id?: string }> = [];
  for (const row of setupRows ?? []) {
    candidates.push({
      name: String(row.school_name),
      source: "setup",
      id: row.id as string,
    });
  }
  for (const row of existingSchools ?? []) {
    candidates.push({
      name: String(row.name),
      source: "existing",
      id: row.id as string,
    });
  }

  const exact = candidates.find(
    (c) => normalizeLookup(c.name) === normalizeLookup(expanded)
  );
  if (exact) {
    return { resolvedName: exact.name, warning: null };
  }

  const { match, ambiguous } = pickBestSchoolNameMatch(expanded, candidates);
  if (match) {
    const warning: SchoolNameResolutionWarning | null =
      normalizeLookup(match.name) !== normalizeLookup(expanded)
        ? {
            worksheetSchoolName: expanded,
            resolvedSchoolName: match.name,
            source: match.source,
          }
        : null;
    return { resolvedName: match.name, warning };
  }

  if (ambiguous.length > 0) {
    return {
      resolvedName: expanded,
      warning: {
        worksheetSchoolName: expanded,
        resolvedSchoolName: expanded,
        source: "worksheet",
        ambiguousCandidates: ambiguous.map((m) => m.name),
      },
    };
  }

  return { resolvedName: expanded, warning: null };
}

/** Link planning rows to schools created during worksheet commit. */
export async function linkPreEtsClassSetupToSchool(
  admin: SupabaseClient,
  input: {
    schoolYear: string;
    districtNumber?: string | null;
    schoolName: string;
    schoolId: string;
    programGroupId?: string | null;
    classTime?: string | null;
  }
): Promise<void> {
  const schoolName = normalizeSchoolName(input.schoolName);
  const settings = await loadPreEtsSettings(admin);
  const year = input.schoolYear.trim() || settings.school_year;

  let query = admin
    .from("pre_ets_class_setup")
    .select("id, class_time, transition_specialist_user_id, transition_specialist_name")
    .eq("school_year", year)
    .is("school_id", null)
    .ilike("school_name", schoolName);

  if (input.districtNumber?.trim()) {
    query = query.eq("district_number", input.districtNumber.trim());
  }

  const { data: rows } = await query;
  if (!rows?.length) return;

  for (const row of rows) {
    await admin
      .from("pre_ets_class_setup")
      .update({
        school_id: input.schoolId,
        linked_program_group_id: input.programGroupId ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id as string);

    if (input.programGroupId && (row.class_time || input.classTime)) {
      await admin
        .from("pre_ets_program_groups")
        .update({
          class_time: row.class_time || input.classTime || null,
        })
        .eq("id", input.programGroupId)
        .is("class_time", null);
    }

    await applyPreEtsClassSetupAssignmentsForRow(admin, {
      schoolId: input.schoolId,
      row: row as { transition_specialist_user_id: string | null },
      setupId: row.id as string,
    });
  }
}

/** Create district/school records for a class setup row when district # is known. */
export async function ensurePreEtsSchoolForClassSetupRow(
  admin: SupabaseClient,
  setupRowId: string,
  schoolYear: string
): Promise<string | null> {
  const { data: row, error } = await admin
    .from("pre_ets_class_setup")
    .select("id, school_id, school_name, district_number")
    .eq("id", setupRowId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!row) return null;
  if (row.school_id) return row.school_id as string;

  const districtNumber = String(row.district_number ?? "").trim();
  const schoolName = normalizeSchoolName(String(row.school_name ?? ""));
  if (!districtNumber || !schoolName) return null;

  const year = schoolYear.trim() || (await loadPreEtsSettings(admin)).school_year;

  const { data: district, error: distErr } = await admin
    .from("pre_ets_districts")
    .upsert(
      {
        gvra_district_number: districtNumber,
        school_year: year,
        label: `District ${districtNumber}`,
      },
      { onConflict: "gvra_district_number,school_year" }
    )
    .select("id")
    .single();

  if (distErr || !district) return null;

  const { data: school, error: schoolErr } = await admin
    .from("pre_ets_schools")
    .upsert(
      {
        district_id: district.id as string,
        name: schoolName,
      },
      { onConflict: "district_id,name" }
    )
    .select("id")
    .single();

  if (schoolErr || !school) return null;

  const schoolId = school.id as string;
  await admin
    .from("pre_ets_class_setup")
    .update({
      school_id: schoolId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", setupRowId);

  return schoolId;
}

/** Link all setup rows that have district numbers but no school_id yet. */
export async function linkClassSetupRowsToSchools(
  admin: SupabaseClient,
  schoolYear?: string
): Promise<{ linked: number }> {
  if (!(await isPreEtsClassSetupSchemaAvailable(admin))) {
    return { linked: 0 };
  }

  const settings = await loadPreEtsSettings(admin);
  const year = schoolYear?.trim() || settings.school_year;

  const { data: rows, error } = await admin
    .from("pre_ets_class_setup")
    .select("id")
    .eq("school_year", year)
    .is("school_id", null)
    .not("district_number", "is", null);

  if (error) throw new Error(error.message);

  let linked = 0;
  for (const row of rows ?? []) {
    const schoolId = await ensurePreEtsSchoolForClassSetupRow(admin, row.id as string, year);
    if (schoolId) linked++;
  }
  return { linked };
}

async function applyPreEtsClassSetupAssignmentsForRow(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    setupId: string;
    row: {
      transition_specialist_user_id: string | null;
      regional_supervisor_user_id?: string | null;
    };
  }
): Promise<void> {
  const { data: setup } = await admin
    .from("pre_ets_class_setup")
    .select("regional_supervisor_user_id, transition_specialist_user_id")
    .eq("id", input.setupId)
    .maybeSingle();

  const tsUserId =
    setup?.transition_specialist_user_id ?? input.row.transition_specialist_user_id;
  const supervisorUserId = setup?.regional_supervisor_user_id ?? null;

  if (tsUserId) {
    await admin.from("pre_ets_staff_school_assignments").upsert(
      {
        school_id: input.schoolId,
        user_id: tsUserId,
        assignment_role: "primary",
      },
      { onConflict: "school_id,user_id,assignment_role" }
    );
  }

  if (supervisorUserId) {
    await admin.from("pre_ets_staff_school_assignments").upsert(
      {
        school_id: input.schoolId,
        user_id: supervisorUserId,
        assignment_role: "supervisor",
      },
      { onConflict: "school_id,user_id,assignment_role" }
    );
  }
}

/** Apply all linked setup rows to staff school assignments. */
export async function applyPreEtsClassSetupAssignments(
  admin: SupabaseClient,
  schoolYear?: string
): Promise<{ applied: number; schoolsLinked: number }> {
  const settings = await loadPreEtsSettings(admin);
  const year = schoolYear?.trim() || settings.school_year;

  const { linked: schoolsLinked } = await linkClassSetupRowsToSchools(admin, year);

  const { data: rows } = await admin
    .from("pre_ets_class_setup")
    .select("id, school_id, transition_specialist_user_id, regional_supervisor_user_id")
    .eq("school_year", year)
    .not("school_id", "is", null);

  let applied = 0;
  for (const row of rows ?? []) {
    if (!row.school_id) continue;
    await applyPreEtsClassSetupAssignmentsForRow(admin, {
      schoolId: row.school_id as string,
      setupId: row.id as string,
      row: row as { transition_specialist_user_id: string | null },
    });
    applied++;
  }
  return { applied, schoolsLinked };
}

function parseClassSetupCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

export function parseClassSetupCsv(text: string): BulkClassSetupRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = parseClassSetupCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (names: string[]): number => {
    for (const name of names) {
      const idx = header.findIndex((h) => h.includes(name));
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const iSupervisor = col(["regional supervisor", "supervisor"]);
  const iSchool = col(["school"]);
  const iDistrict = col(["district"]);
  const iTs = col(["transition specialist", "instructor", "ts"]);
  const iDays = col(["class days", "days"]);
  const iTime = col(["class time", "time"]);
  const iFreq = col(["frequency"]);
  const iCode = col(["service code", "code"]);
  const iNotes = col(["notes"]);

  const pick = (cells: string[], idx: number): string | undefined => {
    if (idx < 0) return undefined;
    return cells[idx]?.trim() || undefined;
  };

  const rows: BulkClassSetupRow[] = [];
  for (let li = 1; li < lines.length; li++) {
    const cells = parseClassSetupCsvLine(lines[li]);
    const schoolName = pick(cells, iSchool >= 0 ? iSchool : 1);
    if (!schoolName) continue;
    rows.push({
      regionalSupervisorName: pick(cells, iSupervisor),
      schoolName,
      districtNumber: pick(cells, iDistrict),
      transitionSpecialistName: pick(cells, iTs),
      classDays: pick(cells, iDays),
      classTime: pick(cells, iTime),
      frequency: pick(cells, iFreq),
      serviceCode: pick(cells, iCode),
      notes: pick(cells, iNotes),
    });
  }
  return rows;
}
