import type { SupabaseClient } from "@supabase/supabase-js";
import { assignPreEtsPrimaryInstructorFromWorksheet } from "./pre-ets-instructor-match";

function normalizeServiceMonth(month: string): string {
  const trimmed = month.trim();
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  return trimmed.slice(0, 10);
}

/** Re-run worksheet instructor → profile matching for existing program groups. */
export async function syncPreEtsInstructorsFromProgramGroups(
  admin: SupabaseClient,
  input?: { serviceMonth?: string }
): Promise<{
  processed: number;
  matched: number;
  unmatched: Array<{ schoolId: string; groupName: string; instructorName: string }>;
}> {
  let query = admin
    .from("pre_ets_program_groups")
    .select("id, school_id, group_name, instructor_name, service_month")
    .not("instructor_name", "is", null);

  if (input?.serviceMonth?.trim()) {
    query = query.eq("service_month", normalizeServiceMonth(input.serviceMonth));
  }

  const { data: groups, error } = await query;
  if (error) throw new Error(error.message);

  let matched = 0;
  const unmatched: Array<{ schoolId: string; groupName: string; instructorName: string }> = [];

  for (const row of groups ?? []) {
    const schoolId = row.school_id as string | null;
    const instructorName = (row.instructor_name as string | null)?.trim();
    if (!schoolId || !instructorName) continue;

    const result = await assignPreEtsPrimaryInstructorFromWorksheet(admin, {
      schoolId,
      programGroupId: row.id as string,
      instructorName,
    });

    if (result.matched) {
      matched++;
    } else {
      unmatched.push({
        schoolId,
        groupName: (row.group_name as string) ?? "",
        instructorName,
      });
    }
  }

  return {
    processed: groups?.length ?? 0,
    matched,
    unmatched,
  };
}
