import type { SupabaseClient } from "@supabase/supabase-js";
import {
  classifyPreEtsAuthorizationType,
  loadPreEtsSettings,
  resolvePreEtsServiceLabel,
  sanitizePreEtsServiceCodeText,
} from "./pre-ets-settings";
import { softHoldPreEtsRosterEntries } from "./pre-ets-field-release";
import { isPreEtsAuthorizationReleasedToField } from "./pre-ets-release";
import {
  notifyPreEtsRosterReleased,
  notifyPreEtsRosterUpdated,
} from "./pre-ets-roster-released-notify";
import type { PreEtsYtdWarning } from "./pre-ets-worksheet-import";

export type FinalizeRosterStudentInput = {
  participantId: string;
  fullName: string;
  unitsApproved: number;
  listOrder?: number;
  classTime?: string | null;
};

export type FinalizeAuthorizationResult =
  | {
      ok: true;
      authorizationId: string;
      ytdWarnings: PreEtsYtdWarning[];
    }
  | { ok: false; error: string };

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function finalizePreEtsAuthorization(
  admin: SupabaseClient,
  input: {
    authorizationId: string;
    actorUserId: string;
    authNumber: string;
    roster: FinalizeRosterStudentInput[];
    serviceCode?: string;
    serviceLabel?: string | null;
  }
): Promise<FinalizeAuthorizationResult> {
  const authNumber = input.authNumber.trim();
  if (!authNumber) {
    return { ok: false, error: "Authorization number is required." };
  }

  const { data: authRow, error: authErr } = await admin
    .from("pre_ets_authorizations")
    .select(
      "id, auth_type, auth_number, field_released_at, service_code, service_label, service_month, school_id, program_group_id, pre_ets_schools(name, pre_ets_districts(school_year))"
    )
    .eq("id", input.authorizationId)
    .maybeSingle();

  if (authErr || !authRow) {
    return { ok: false, error: authErr?.message ?? "Authorization not found." };
  }

  if (authRow.auth_type !== "pending" && authRow.auth_number) {
    return { ok: false, error: "This authorization is already finalized." };
  }

  const school = relationOne(
    authRow.pre_ets_schools as
      | { name: string; pre_ets_districts: { school_year: string } | { school_year: string }[] }
      | { name: string; pre_ets_districts: { school_year: string } | { school_year: string }[] }[]
      | null
  );
  const district = school
    ? relationOne(school.pre_ets_districts as { school_year: string } | { school_year: string }[])
    : null;
  const schoolYear = district?.school_year;
  if (!schoolYear) {
    return { ok: false, error: "Could not resolve school year for this authorization." };
  }

  const settings = await loadPreEtsSettings(admin);
  const serviceCode = sanitizePreEtsServiceCodeText(
    input.serviceCode?.trim() || (authRow.service_code as string) || "UNKNOWN"
  );
  const serviceLabel =
    input.serviceLabel !== undefined && input.serviceLabel !== null
      ? input.serviceLabel.trim() || null
      : resolvePreEtsServiceLabel(
          serviceCode,
          (authRow.service_label as string | null) ?? null,
          settings
        );

  const authType = classifyPreEtsAuthorizationType(authNumber, settings.group_auth_digit_count);
  if (authType === "unknown") {
    return { ok: false, error: "Authorization number format is not recognized as group or individual." };
  }

  if (authType === "individual" && input.roster.length > 1) {
    return { ok: false, error: "Individual authorizations may only have one student on the roster." };
  }

  if (input.roster.length === 0) {
    return { ok: false, error: "At least one student is required on the roster." };
  }

  const schoolId = authRow.school_id as string;
  const serviceMonth = authRow.service_month as string;
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

    await admin.from("pre_ets_student_ytd_units").upsert(
      {
        student_id: studentId,
        school_year: schoolYear,
        billable_units: 0,
      },
      { onConflict: "student_id,school_year", ignoreDuplicates: true }
    );

    const { data: ytd } = await admin
      .from("pre_ets_student_ytd_units")
      .select("billable_units")
      .eq("student_id", studentId)
      .eq("school_year", schoolYear)
      .maybeSingle();

    const currentYtd = (ytd?.billable_units as number) ?? 0;
    const units = Math.max(0, Math.floor(Number(row.unitsApproved) || 0));
    if (currentYtd + units > ytdThreshold && !warnedParticipants.has(participantId)) {
      warnedParticipants.add(participantId);
      ytdWarnings.push({
        participantId,
        fullName,
        currentYtd,
        unitsAdding: units,
        threshold: ytdThreshold,
      });
    }

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

  const { data: existingEntries } = await admin
    .from("pre_ets_roster_entries")
    .select("id, student_id, removed_at")
    .eq("authorization_id", input.authorizationId);

  const toHold = (existingEntries ?? []).filter(
    (e) => !keptStudentIds.has(e.student_id as string) && !e.removed_at
  );
  if (toHold.length > 0) {
    await softHoldPreEtsRosterEntries(
      admin,
      toHold.map((e) => e.id as string),
      "removed_on_finalize"
    );
  }

  const previousServiceCode = sanitizePreEtsServiceCodeText(
    (authRow.service_code as string) || "UNKNOWN"
  );
  const wasReleased = isPreEtsAuthorizationReleasedToField({
    auth_number: authRow.auth_number as string | null,
    auth_type: authRow.auth_type as string,
    field_released_at: authRow.field_released_at as string | null,
  });

  const { error: updErr } = await admin
    .from("pre_ets_authorizations")
    .update({
      auth_number: authNumber,
      auth_type: authType,
      service_code: serviceCode,
      service_label: serviceLabel,
      ...(wasReleased
        ? {}
        : {
            field_released_at: new Date().toISOString(),
            field_released_by: input.actorUserId,
          }),
    })
    .eq("id", input.authorizationId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  const schoolLabel = school?.name ?? "School";
  if (wasReleased) {
    const parts: string[] = ["Authorization number was added or updated"];
    if (previousServiceCode !== serviceCode) {
      parts.push(`service code changed to ${serviceCode}`);
    }
    if (toHold.length > 0) {
      parts.push(`${toHold.length} student(s) removed from the active roster`);
    }
    await notifyPreEtsRosterUpdated(admin, {
      authorizationId: input.authorizationId,
      schoolId,
      schoolLabel,
      serviceMonth,
      changeSummary: parts.join("; ") + ". Open Pre-ETS to review.",
    });
  } else {
    await notifyPreEtsRosterReleased(admin, {
      authorizationId: input.authorizationId,
      schoolId,
      schoolLabel,
      authNumber,
      serviceMonth,
    });
  }

  return { ok: true, authorizationId: input.authorizationId, ytdWarnings };
}
