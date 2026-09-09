import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings } from "./pre-ets-settings";

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
  const settings = await loadPreEtsSettings(admin);
  const year = schoolYear?.trim() || settings.school_year;

  const { data, error } = await admin
    .from("pre_ets_class_setup")
    .select("*")
    .eq("school_year", year)
    .order("regional_supervisor_name", { ascending: true })
    .order("school_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as PreEtsClassSetupRow[];
}

export async function upsertPreEtsClassSetupEntry(
  admin: SupabaseClient,
  input: ClassSetupInput & { id?: string },
  actorUserId: string
): Promise<PreEtsClassSetupRow> {
  const settings = await loadPreEtsSettings(admin);
  const schoolName = normalizeSchoolName(input.schoolName);
  if (!schoolName) {
    throw new Error("School name is required");
  }

  const supervisor = await resolveStaffUserId(admin, input.regionalSupervisorName ?? null, [
    "supervisor",
    "admin",
    "super_admin",
  ]);
  const ts = await resolveStaffUserId(admin, input.transitionSpecialistName ?? null, [
    "transition_specialist",
    "instructor",
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

  if (input.id) {
    const { data, error } = await admin
      .from("pre_ets_class_setup")
      .update(patch)
      .eq("id", input.id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Update failed");
    return data as PreEtsClassSetupRow;
  }

  const { data, error } = await admin
    .from("pre_ets_class_setup")
    .insert(patch)
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Insert failed");
  return data as PreEtsClassSetupRow;
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
): Promise<{ applied: number }> {
  const settings = await loadPreEtsSettings(admin);
  const year = schoolYear?.trim() || settings.school_year;

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
  return { applied };
}

export function parseClassSetupCsv(text: string): BulkClassSetupRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
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
    const cells = lines[li].split(",").map((c) => c.trim());
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
