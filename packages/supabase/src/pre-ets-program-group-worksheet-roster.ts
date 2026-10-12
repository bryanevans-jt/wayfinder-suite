import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDistrictWorksheet,
  worksheetHeaderKeysMatch,
  type ParsedWorksheetGroup,
} from "./pre-ets-worksheet-parser";
import { normalizeProgramGroupNameKey } from "./pre-ets-worksheet-group-mapping";
import { canonicalizeWorksheetSchoolName } from "./pre-ets-worksheet-known-schools";
import { loadPreEtsSettings } from "./pre-ets-settings";

/** Participant IDs listed under this header line on the last committed worksheet import. */
export async function loadWorksheetParticipantAllowlistForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<Set<string> | null> {
  const { data: pg } = await admin
    .from("pre_ets_program_groups")
    .select(
      "header_raw, worksheet_header_key, worksheet_import_id, group_name, pre_ets_schools(name)"
    )
    .eq("id", programGroupId)
    .maybeSingle();

  if (!pg?.worksheet_import_id) return null;

  const headerRaw = String(pg.header_raw ?? "").trim();
  const headerKey = String(pg.worksheet_header_key ?? "").trim();
  if (!headerRaw && !headerKey) return null;

  const { data: imp } = await admin
    .from("pre_ets_worksheet_imports")
    .select("file_content, status")
    .eq("id", pg.worksheet_import_id as string)
    .maybeSingle();

  const fileContent = typeof imp?.file_content === "string" ? imp.file_content.trim() : "";
  if (!fileContent || imp?.status !== "committed") return null;

  const settings = await loadPreEtsSettings(admin);
  const parsed = parseDistrictWorksheet(fileContent, {
    notApprovedMarker: settings.not_approved_marker,
    groupAuthDigitCount: settings.group_auth_digit_count,
  });

  const allGroups = parsed.offices.flatMap((o) => o.groups);
  const schoolRel = pg.pre_ets_schools as { name: string } | { name: string }[] | null;
  const schoolName = Array.isArray(schoolRel) ? schoolRel[0]?.name : schoolRel?.name;
  const matched = collectParsedWorksheetGroupsForProgramGroup(allGroups, {
    headerRaw,
    headerKey,
    groupName: String(pg.group_name ?? ""),
    schoolName: schoolName ?? "",
  });
  if (matched.length === 0) return null;

  const pids = new Set<string>();
  for (const group of matched) {
    for (const student of group.students) {
      if (student.notApproved) continue;
      const pid = student.participantId.trim();
      if (pid) pids.add(pid);
    }
  }
  return pids;
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
  if (!groupKey) return out;

  for (const group of groups) {
    const headerId = group.headerRaw.trim().toLowerCase();
    if (seenHeaders.has(headerId)) continue;

    const gSchool = normalizeProgramGroupNameKey(
      canonicalizeWorksheetSchoolName(group.schoolName)
    );
    const gGroup = normalizeProgramGroupNameKey(group.groupName);
    if (gSchool === schoolKey && gGroup === groupKey) {
      out.push(group);
      seenHeaders.add(headerId);
    }
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
