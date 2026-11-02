import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDistrictWorksheet,
  worksheetHeaderGroupNumberToken,
  worksheetHeaderKeysMatch,
  type ParsedWorksheetGroup,
} from "./pre-ets-worksheet-parser";
import { normalizeProgramGroupNameKey } from "./pre-ets-worksheet-group-mapping";
import { canonicalizeWorksheetSchoolName } from "./pre-ets-worksheet-known-schools";
import { loadPreEtsSettings } from "./pre-ets-settings";
import { fetchAllPostgrestRows } from "./postgrest-fetch-all";

/** Participant IDs listed under this header line on the last committed worksheet import. */
export async function loadWorksheetParticipantAllowlistForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<Set<string> | null> {
  const allowlists = await loadWorksheetParticipantAllowlistsForProgramGroups(
    admin,
    [programGroupId]
  );
  return allowlists.get(programGroupId) ?? null;
}

/** Parse each committed worksheet once while resolving allowlists for many groups. */
export async function loadWorksheetParticipantAllowlistsForProgramGroups(
  admin: SupabaseClient,
  programGroupIds: string[]
): Promise<Map<string, Set<string> | null>> {
  const ids = [...new Set(programGroupIds.map((id) => id.trim()).filter(Boolean))];
  const out = new Map<string, Set<string> | null>(
    ids.map((id) => [id, null])
  );
  if (ids.length === 0) return out;

  type GroupRow = {
    id: string;
    header_raw: string | null;
    worksheet_header_key: string | null;
    worksheet_import_id: string | null;
    group_name: string | null;
    pre_ets_schools: { name: string } | { name: string }[] | null;
  };
  const groups = await fetchAllPostgrestRows<GroupRow>(
    admin,
    "pre_ets_program_groups",
    "id, header_raw, worksheet_header_key, worksheet_import_id, group_name, pre_ets_schools(name)",
    { applyFilters: (query) => query.in("id", ids) }
  );
  const importIds = [
    ...new Set(
      groups
        .map((group) => group.worksheet_import_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (importIds.length === 0) return out;

  const imports = await fetchAllPostgrestRows<{
    id: string;
    file_content: string | null;
    status: string;
  }>(
    admin,
    "pre_ets_worksheet_imports",
    "id, file_content, status",
    { applyFilters: (query) => query.in("id", importIds) }
  );
  const settings = await loadPreEtsSettings(admin);
  const parsedGroupsByImport = new Map<string, ParsedWorksheetGroup[]>();
  for (const worksheetImport of imports) {
    const fileContent = worksheetImport.file_content?.trim() ?? "";
    if (!fileContent || worksheetImport.status !== "committed") continue;
    const parsed = parseDistrictWorksheet(fileContent, {
      notApprovedMarker: settings.not_approved_marker,
      groupAuthDigitCount: settings.group_auth_digit_count,
    });
    parsedGroupsByImport.set(
      worksheetImport.id,
      parsed.offices.flatMap((office) => office.groups)
    );
  }

  for (const group of groups) {
    if (!group.worksheet_import_id) continue;
    const parsedGroups = parsedGroupsByImport.get(group.worksheet_import_id);
    if (!parsedGroups) continue;
    const headerRaw = group.header_raw?.trim() ?? "";
    const headerKey = group.worksheet_header_key?.trim() ?? "";
    if (!headerRaw && !headerKey) continue;
    const schoolRel = group.pre_ets_schools;
    const schoolName = Array.isArray(schoolRel)
      ? schoolRel[0]?.name
      : schoolRel?.name;
    const matched = collectParsedWorksheetGroupsForProgramGroup(parsedGroups, {
      headerRaw,
      headerKey,
      groupName: group.group_name ?? "",
      schoolName: schoolName ?? "",
    });
    if (matched.length === 0) continue;
    const pids = new Set<string>();
    for (const parsedGroup of matched) {
      for (const student of parsedGroup.students) {
        if (student.notApproved) continue;
        const pid = student.participantId.trim();
        if (pid) pids.add(pid);
      }
    }
    out.set(group.id, pids);
  }
  return out;
}

/** Match header line first; also include spreadsheet sections with the same school + group name. */
export function collectParsedWorksheetGroupsForProgramGroup(
  groups: ParsedWorksheetGroup[],
  target: { headerRaw: string; headerKey: string; groupName: string; schoolName: string }
): ParsedWorksheetGroup[] {
  const out: ParsedWorksheetGroup[] = [];
  const seenHeaders = new Set<string>();

  const headerMatch = findParsedWorksheetGroupForProgramGroup(groups, {
    headerRaw: target.headerRaw,
    headerKey: target.headerKey,
  });
  if (headerMatch) {
    out.push(headerMatch);
    seenHeaders.add(headerMatch.headerRaw.trim().toLowerCase());
  }

  const schoolKey = normalizeProgramGroupNameKey(
    canonicalizeWorksheetSchoolName(target.schoolName)
  );
  const groupKey = normalizeProgramGroupNameKey(target.groupName);
  const targetGroupNumber = worksheetHeaderGroupNumberToken(
    target.headerRaw || target.headerKey
  );
  if (!groupKey) return out;

  for (const group of groups) {
    const headerId = group.headerRaw.trim().toLowerCase();
    if (seenHeaders.has(headerId)) continue;

    const gSchool = normalizeProgramGroupNameKey(
      canonicalizeWorksheetSchoolName(group.schoolName)
    );
    const gGroup = normalizeProgramGroupNameKey(group.groupName);
    if (gSchool !== schoolKey || gGroup !== groupKey) continue;

    const candidateGroupNumber = worksheetHeaderGroupNumberToken(group.headerRaw);
    if (
      targetGroupNumber &&
      candidateGroupNumber &&
      targetGroupNumber !== candidateGroupNumber
    ) {
      continue;
    }

    out.push(group);
    seenHeaders.add(headerId);
  }

  return out;
}

export function findParsedWorksheetGroupForProgramGroup(
  groups: ParsedWorksheetGroup[],
  target: { headerRaw: string; headerKey: string }
): ParsedWorksheetGroup | null {
  const needles = [target.headerRaw.trim(), target.headerKey.trim()].filter(Boolean);
  if (needles.length === 0) return null;

  for (const group of groups) {
    const groupRaw = group.headerRaw.trim();
    if (!groupRaw) continue;
    if (needles.some((needle) => worksheetHeaderKeysMatch(groupRaw, needle))) {
      return group;
    }
  }
  return null;
}
