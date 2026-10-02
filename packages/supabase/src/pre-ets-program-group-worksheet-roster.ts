import type { SupabaseClient } from "@supabase/supabase-js";
import {
  parseDistrictWorksheet,
  worksheetHeaderKeysMatch,
  type ParsedWorksheetGroup,
} from "./pre-ets-worksheet-parser";
import { loadPreEtsSettings } from "./pre-ets-settings";

/** Participant IDs listed under this header line on the last committed worksheet import. */
export async function loadWorksheetParticipantAllowlistForProgramGroup(
  admin: SupabaseClient,
  programGroupId: string
): Promise<Set<string> | null> {
  const { data: pg } = await admin
    .from("pre_ets_program_groups")
    .select("header_raw, worksheet_header_key, worksheet_import_id")
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

  const matched = findParsedWorksheetGroupForProgramGroup(parsed.offices.flatMap((o) => o.groups), {
    headerRaw,
    headerKey,
  });
  if (!matched) return null;

  const pids = new Set<string>();
  for (const student of matched.students) {
    if (student.notApproved) continue;
    const pid = student.participantId.trim();
    if (pid) pids.add(pid);
  }
  return pids;
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
