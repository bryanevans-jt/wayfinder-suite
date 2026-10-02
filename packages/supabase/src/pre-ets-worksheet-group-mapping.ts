import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedWorksheetGroup } from "./pre-ets-worksheet-parser";
import {
  normalizeWorksheetHeaderKey,
  normalizeWorksheetHeaderKeyLoose,
  worksheetHeaderKeysMatch,
} from "./pre-ets-worksheet-parser";
import {
  canonicalizeWorksheetSchoolName,
  looksLikeKnownWorksheetSchoolLabel,
} from "./pre-ets-worksheet-known-schools";
import { parseGroupHeader } from "./pre-ets-worksheet-parser";

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
    const typed = row as PreEtsWorksheetGroupMappingRow;
    map.set(row.worksheet_header_key as string, typed);
    const sample = typed.header_raw_sample?.trim();
    if (sample) {
      map.set(normalizeWorksheetHeaderKeyLoose(sample), typed);
    }
  }
  return map;
}

/** Resolve a saved Fix labels mapping across CSV/Excel header formatting differences. */
export function resolveWorksheetGroupMapping(
  map: Map<string, PreEtsWorksheetGroupMappingRow>,
  headerRaw: string
): PreEtsWorksheetGroupMappingRow | undefined {
  const trimmed = headerRaw.trim();
  if (!trimmed) return undefined;

  const direct = map.get(normalizeWorksheetHeaderKey(trimmed));
  if (direct) return direct;

  for (const row of map.values()) {
    if (row.header_raw_sample && worksheetHeaderKeysMatch(row.header_raw_sample, trimmed)) {
      return row;
    }
    if (worksheetHeaderKeysMatch(row.worksheet_header_key, trimmed)) {
      return row;
    }
  }

  return undefined;
}

export function applyWorksheetGroupMapping(
  group: ParsedWorksheetGroup,
  mapping: PreEtsWorksheetGroupMappingRow
): void {
  group.schoolName = mapping.canonical_school_name;
  group.groupName = mapping.canonical_group_name;
  group.instructorName = mapping.canonical_instructor_name;
}

/** Ignore Fix labels rows that would remap Upson Lee (etc.) onto a different school. */
export function worksheetGroupMappingMatchesParsedSchool(
  headerRaw: string,
  mapping: PreEtsWorksheetGroupMappingRow
): boolean {
  const parsedSchool = parseGroupHeader(headerRaw).schoolName;
  if (!parsedSchool.trim()) return true;

  const headerCanon = canonicalizeWorksheetSchoolName(parsedSchool).toLowerCase();
  const mappingCanon = canonicalizeWorksheetSchoolName(mapping.canonical_school_name).toLowerCase();
  if (headerCanon === mappingCanon) return true;

  if (
    looksLikeKnownWorksheetSchoolLabel(parsedSchool) ||
    looksLikeKnownWorksheetSchoolLabel(mapping.canonical_school_name)
  ) {
    return headerCanon === mappingCanon;
  }

  return true;
}

export async function findProgramGroupForWorksheetImport(
  admin: SupabaseClient,
  input: {
    schoolId: string;
    serviceMonth: string;
    group: ParsedWorksheetGroup;
  }
): Promise<string | null> {
  const headerRaw = input.group.headerRaw.trim();
  const headerKey = normalizeWorksheetHeaderKey(headerRaw);

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

    const { data: groups } = await admin
      .from("pre_ets_program_groups")
      .select("id, worksheet_header_key, header_raw, group_name, instructor_name")
      .eq("school_id", input.schoolId)
      .eq("service_month", input.serviceMonth);

    for (const row of groups ?? []) {
      const storedKey = (row.worksheet_header_key as string | null) ?? "";
      const storedRaw = (row.header_raw as string | null) ?? "";
      if (
        (storedKey && worksheetHeaderKeysMatch(storedKey, headerRaw)) ||
        (storedRaw && worksheetHeaderKeysMatch(storedRaw, headerRaw))
      ) {
        return row.id as string;
      }
    }
  }

  return null;
}

/** Reject a program group id when its saved header is a different spreadsheet line. */
export function programGroupMatchesWorksheetHeader(
  stored: { worksheet_header_key: string | null; header_raw: string | null },
  headerRaw: string
): boolean {
  const trimmed = headerRaw.trim();
  if (!trimmed) return true;
  const storedKey = stored.worksheet_header_key?.trim() ?? "";
  const storedRaw = stored.header_raw?.trim() ?? "";
  if (!storedKey && !storedRaw) return true;
  if (storedKey && worksheetHeaderKeysMatch(storedKey, trimmed)) return true;
  if (storedRaw && worksheetHeaderKeysMatch(storedRaw, trimmed)) return true;
  return false;
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
