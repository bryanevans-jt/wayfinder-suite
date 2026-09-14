import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPreEtsSettings } from "./pre-ets-settings";
import type { FinalizeRosterStudentInput } from "./pre-ets-authorization-finalize";
import type { PreEtsYtdWarning } from "./pre-ets-worksheet-import";

export type UpdatePendingRosterResult =
  | { ok: true; ytdWarnings: PreEtsYtdWarning[] }
  | { ok: false; error: string };

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Edit roster lines on a pending authorization (no auth number change). */
export async function updatePendingPreEtsRoster(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    roster: FinalizeRosterStudentInput[];
  }
): Promise<UpdatePendingRosterResult> {
  const { data: authRow, error: authErr } = await admin
    .from("pre_ets_authorizations")
    .select(
      "id, auth_type, auth_number, school_id, pre_ets_schools(name, pre_ets_districts(school_year))"
    )
    .eq("id", input.authorizationId)
    .maybeSingle();

  if (authErr || !authRow) {
    return { ok: false, error: authErr?.message ?? "Authorization not found." };
  }

  if (authRow.auth_number || authRow.auth_type !== "pending") {
    return { ok: false, error: "Only pending authorizations can be edited this way." };
  }

  if (input.roster.length === 0) {
    return { ok: false, error: "At least one student is required on the roster." };
  }

  const school = relationOne(
    authRow.pre_ets_schools as
      | { pre_ets_districts: { school_year: string } | { school_year: string }[] }
      | { pre_ets_districts: { school_year: string } | { school_year: string }[] }[]
      | null
  );
  const district = school
    ? relationOne(school.pre_ets_districts as { school_year: string } | { school_year: string }[])
    : null;
  const schoolYear = district?.school_year;
  if (!schoolYear) {
    return { ok: false, error: "Could not resolve school year." };
  }

  const schoolId = authRow.school_id as string;
  const settings = await loadPreEtsSettings(admin);
  const ytdThreshold = settings.ytd_unit_warning_threshold;
  const ytdWarnings: PreEtsYtdWarning[] = [];
  const warnedParticipants = new Set<string>();
  const keptStudentIds = new Set<string>();

  for (let i = 0; i < input.roster.length; i++) {
    const row = input.roster[i]!;
    const participantId = row.participantId.trim();
    const fullName = row.fullName.trim();
    if (!participantId || !fullName) {
      return { ok: false, error: "Each roster row needs participant ID and student name." };
    }

    const { data: student, error: stuErr } = await admin
      .from("pre_ets_students")
      .upsert(
        {
          participant_id: participantId,
          full_name: fullName,
          school_year: schoolYear,
          primary_school_id: schoolId,
        },
        { onConflict: "participant_id,school_year" }
      )
      .select("id")
      .single();

    if (stuErr || !student) {
      return { ok: false, error: stuErr?.message ?? "Could not save student." };
    }

    const studentId = student.id as string;
    keptStudentIds.add(studentId);

    const units = Math.max(0, Math.floor(Number(row.unitsApproved) || 0));

    await admin.from("pre_ets_roster_entries").upsert(
      {
        authorization_id: input.authorizationId,
        student_id: studentId,
        units_approved: units,
        class_time: row.classTime ?? null,
        not_approved: false,
        list_order: row.listOrder ?? i + 1,
      },
      { onConflict: "authorization_id,student_id" }
    );
  }

  const { data: existingEntries } = await admin
    .from("pre_ets_roster_entries")
    .select("id, student_id")
    .eq("authorization_id", input.authorizationId);

  const toRemove = (existingEntries ?? []).filter(
    (e) => !keptStudentIds.has(e.student_id as string)
  );
  if (toRemove.length > 0) {
    await admin
      .from("pre_ets_roster_entries")
      .delete()
      .in(
        "id",
        toRemove.map((e) => e.id as string)
      );
  }

  return { ok: true, ytdWarnings };
}
