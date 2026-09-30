import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedWorksheetGroup } from "./pre-ets-worksheet-parser";
import { normalizeWorksheetHeaderKey } from "./pre-ets-worksheet-parser";
import { findProgramGroupId } from "./pre-ets-worksheet-auth-match";

export type PreEtsWorksheetGroupMappingRow = {
  id: string;
  school_year: string;
  district_id: string;
  worksheet_header_key: string;
  header_raw_sample: string | null;
  canonical_school_name: string;
  canonical_group_name: string;
  canonical_instructor_name: string | null;
  canonical_school_id: string | null;
};

export { normalizeWorksheetHeaderKey };

function normalizeSchoolName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export async function loadWorksheetGroupMappings(
  admin: SupabaseClient,
  input: { schoolYear: string; districtId: string }
): Promise<Map<string, PreEtsWorksheetGroupMappingRow>> {
  const { data, error } = await admin
    .from("pre_ets_worksheet_group_mappings")
    .select("*")
    .eq("school_year", input.schoolYear)
    .eq("district_id", input.districtId);

  if (error) throw new Error(error.message);

  const map = new Map<string, PreEtsWorksheetGroupMappingRow>();
  for (const row of data ?? []) {
    map.set(row.worksheet_header_key as string, row as PreEtsWorksheetGroupMappingRow);
  }
  return map;
}

export function applyWorksheetGroupMapping(
  group: ParsedWorksheetGroup,
  mapping: PreEtsWorksheetGroupMappingRow
): void {
  group.schoolName = mapping.canonical_school_name;
  group.groupName = mapping.canonical_group_name;
  group.instructorName = mapping.canonical_instructor_name;
}

export async function findProgramGroupForWorksheetImport(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    serviceMonth: string;
    group: ParsedWorksheetGroup;
  }
): Promise<string | null> {
  const headerKey = normalizeWorksheetHeaderKey(input.group.headerRaw);
  if (headerKey) {
    const { data: byKey } = await admin
      .from("pre_ets_program_groups")
      .select("id")
      .eq("school_id", input.schoolId)
      .eq("service_month", input.serviceMonth)
      .eq("worksheet_header_key", headerKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (byKey?.id) return byKey.id as string;
  }

  return findProgramGroupId(
    admin,
    input.schoolId,
    input.serviceMonth,
    input.group.groupName
  );
}

export async function upsertWorksheetGroupMapping(
  admin: SupabaseClient,
  input: {
    schoolYear: string;
    districtId: string;
    headerRaw: string;
    canonicalSchoolName: string;
    canonicalGroupName: string;
    canonicalInstructorName: string | null;
    canonicalSchoolId: string | null;
    actorUserId: string;
  }
): Promise<void> {
  const worksheet_header_key = normalizeWorksheetHeaderKey(input.headerRaw);
  if (!worksheet_header_key) {
    throw new Error("Worksheet header is required to save a mapping");
  }

  const patch = {
    school_year: input.schoolYear,
    district_id: input.districtId,
    worksheet_header_key,
    header_raw_sample: input.headerRaw.trim(),
    canonical_school_name: normalizeSchoolName(input.canonicalSchoolName),
    canonical_group_name: normalizeSchoolName(input.canonicalGroupName),
    canonical_instructor_name: input.canonicalInstructorName?.trim() || null,
    canonical_school_id: input.canonicalSchoolId,
    updated_at: new Date().toISOString(),
    updated_by: input.actorUserId,
  };

  const { error } = await admin.from("pre_ets_worksheet_group_mappings").upsert(patch, {
    onConflict: "school_year,district_id,worksheet_header_key",
  });

  if (error) throw new Error(error.message);
}

export type UpdateProgramGroupLabelsInput = {
  programGroupId: string;
  schoolName: string;
  groupName: string;
  instructorName: string | null;
  rememberForFutureImports: boolean;
  actorUserId: string;
};

export type UpdateProgramGroupLabelsResult =
  | {
      ok: true;
      programGroupId: string;
      schoolId: string;
      mappingSaved: boolean;
    }
  | { ok: false; error: string };

export async function updateProgramGroupLabels(
  admin: SupabaseClient,
  input: UpdateProgramGroupLabelsInput
): Promise<UpdateProgramGroupLabelsResult> {
  const schoolName = normalizeSchoolName(input.schoolName);
  const groupName = normalizeSchoolName(input.groupName);
  if (!schoolName || !groupName) {
    return { ok: false, error: "School name and group name are required" };
  }

  const { data: pg, error: pgErr } = await admin
    .from("pre_ets_program_groups")
    .select(
      "id, header_raw, worksheet_header_key, service_month, school_id, pre_ets_schools(id, name, district_id, pre_ets_districts(school_year, gvra_district_number))"
    )
    .eq("id", input.programGroupId)
    .maybeSingle();

  if (pgErr || !pg) {
    return { ok: false, error: pgErr?.message ?? "Program group not found" };
  }

  type SchoolRel = {
    id: string;
    name: string;
    district_id: string;
    pre_ets_districts:
      | { school_year: string; gvra_district_number: string }
      | { school_year: string; gvra_district_number: string }[]
      | null;
  };

  const schoolRelRaw = pg.pre_ets_schools as unknown;
  const schoolRow: SchoolRel | null = Array.isArray(schoolRelRaw)
    ? (schoolRelRaw[0] as SchoolRel | undefined) ?? null
    : (schoolRelRaw as SchoolRel | null);
  if (!schoolRow?.district_id) {
    return { ok: false, error: "Could not resolve district for this group" };
  }

  const districtId = schoolRow.district_id;
  const districtRaw = schoolRow.pre_ets_districts;
  const districtMeta = Array.isArray(districtRaw) ? districtRaw[0] : districtRaw;
  const schoolYear = districtMeta?.school_year ?? "";

  let targetSchoolId = schoolRow.id as string;
  if (normalizeSchoolName(schoolRow.name) !== schoolName) {
    const { data: officeLink } = await admin
      .from("pre_ets_schools")
      .select("gvra_office_id")
      .eq("id", schoolRow.id)
      .maybeSingle();

    const { data: newSchool, error: schoolErr } = await admin
      .from("pre_ets_schools")
      .upsert(
        {
          district_id: districtId,
          gvra_office_id: officeLink?.gvra_office_id ?? null,
          name: schoolName,
        },
        { onConflict: "district_id,name" }
      )
      .select("id")
      .single();

    if (schoolErr || !newSchool) {
      return { ok: false, error: schoolErr?.message ?? "Could not update school" };
    }
    targetSchoolId = newSchool.id as string;
  }

  const headerRaw = String(pg.header_raw ?? "").trim();
  const worksheet_header_key =
    (pg.worksheet_header_key as string | null) ??
    (headerRaw ? normalizeWorksheetHeaderKey(headerRaw) : null);

  const { error: updateErr } = await admin
    .from("pre_ets_program_groups")
    .update({
      school_id: targetSchoolId,
      group_name: groupName,
      instructor_name: input.instructorName?.trim() || null,
      worksheet_header_key,
    })
    .eq("id", input.programGroupId);

  if (updateErr) {
    return { ok: false, error: updateErr.message };
  }

  await admin
    .from("pre_ets_authorizations")
    .update({ school_id: targetSchoolId })
    .eq("program_group_id", input.programGroupId);

  let mappingSaved = false;
  if (input.rememberForFutureImports && headerRaw && schoolYear) {
    await upsertWorksheetGroupMapping(admin, {
      schoolYear,
      districtId,
      headerRaw,
      canonicalSchoolName: schoolName,
      canonicalGroupName: groupName,
      canonicalInstructorName: input.instructorName,
      canonicalSchoolId: targetSchoolId,
      actorUserId: input.actorUserId,
    });
    mappingSaved = true;
  }

  return {
    ok: true,
    programGroupId: input.programGroupId,
    schoolId: targetSchoolId,
    mappingSaved,
  };
}
