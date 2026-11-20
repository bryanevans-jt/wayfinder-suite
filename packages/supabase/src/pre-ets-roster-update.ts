import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinalizeRosterStudentInput } from "./pre-ets-authorization-finalize";
import { softHoldPreEtsRosterEntries } from "./pre-ets-field-release";
import { isPreEtsAuthorizationReleasedToField } from "./pre-ets-release";
import { notifyPreEtsRosterUpdated } from "./pre-ets-roster-released-notify";
import type { PreEtsYtdWarning } from "./pre-ets-worksheet-import";

export type UpdatePendingRosterResult =
  | {
      ok: true;
      ytdWarnings: PreEtsYtdWarning[];
      addedStudentIds: string[];
      removedStudentIds: string[];
      keptStudentIds: string[];
    }
  | { ok: false; error: string };

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Edit roster lines on an authorization (no auth number change). */
export async function updatePendingPreEtsRoster(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    roster: FinalizeRosterStudentInput[];
    /** Accounts Specialist / Admin / Super Admin — allow edits after A&I / finalized auth type. */
    allowAfterAuthorization?: boolean;
  }
): Promise<UpdatePendingRosterResult> {
  const { data: authRow, error: authErr } = await admin
    .from("pre_ets_authorizations")
    .select(
      "id, auth_type, auth_number, field_released_at, service_month, school_id, pre_ets_schools(name, pre_ets_districts(school_year))"
    )
    .eq("id", input.authorizationId)
    .maybeSingle();

  if (authErr || !authRow) {
    return { ok: false, error: authErr?.message ?? "Authorization not found." };
  }

  const hasAuthorizationNumber = Boolean((authRow.auth_number as string | null)?.trim());
  const isPending = authRow.auth_type === "pending";
  if (!input.allowAfterAuthorization) {
    if (hasAuthorizationNumber || !isPending) {
      return { ok: false, error: "Only pending authorizations can be edited this way." };
    }
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
  const ytdWarnings: PreEtsYtdWarning[] = [];

  const { data: existingEntries } = await admin
    .from("pre_ets_roster_entries")
    .select("id, student_id, removed_at")
    .eq("authorization_id", input.authorizationId);

  const previousActiveStudentIds = new Set(
    (existingEntries ?? [])
      .filter((e) => !e.removed_at)
      .map((e) => e.student_id as string)
  );
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

    // Upsert restores soft-held students (clears removed_at).
    await admin.from("pre_ets_roster_entries").upsert(
      {
        authorization_id: input.authorizationId,
        student_id: studentId,
        units_approved: units,
        class_time: row.classTime ?? null,
        not_approved: false,
        list_order: row.listOrder ?? i + 1,
        removed_at: null,
        removed_reason: null,
      },
      { onConflict: "authorization_id,student_id" }
    );
  }

  const toHold = (existingEntries ?? []).filter(
    (e) => !keptStudentIds.has(e.student_id as string) && !e.removed_at
  );
  if (toHold.length > 0) {
    await softHoldPreEtsRosterEntries(
      admin,
      toHold.map((e) => e.id as string),
      "removed_from_active_roster"
    );
  }

  const removedStudentIds = toHold.map((e) => e.student_id as string);
  const addedStudentIds = [...keptStudentIds].filter(
    (id) => !previousActiveStudentIds.has(id)
  );

  const schoolName = relationOne(
    authRow.pre_ets_schools as { name: string } | { name: string }[] | null
  )?.name;
  if (
    isPreEtsAuthorizationReleasedToField({
      auth_number: authRow.auth_number as string | null,
      auth_type: authRow.auth_type as string,
      field_released_at: authRow.field_released_at as string | null,
    }) &&
    (addedStudentIds.length > 0 || removedStudentIds.length > 0)
  ) {
    const parts: string[] = [];
    if (addedStudentIds.length) parts.push(`${addedStudentIds.length} student(s) added`);
    if (removedStudentIds.length) {
      parts.push(`${removedStudentIds.length} student(s) removed from the active roster`);
    }
    await notifyPreEtsRosterUpdated(admin, {
      authorizationId: input.authorizationId,
      schoolId,
      schoolLabel: schoolName ?? "School",
      serviceMonth: String(authRow.service_month ?? ""),
      changeSummary: parts.join("; ") + ". Open Pre-ETS to review the updated roster.",
    });
  }

  return {
    ok: true,
    ytdWarnings,
    addedStudentIds,
    removedStudentIds,
    keptStudentIds: [...keptStudentIds],
  };
}
