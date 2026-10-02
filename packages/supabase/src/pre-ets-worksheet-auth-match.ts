import type { SupabaseClient } from "@supabase/supabase-js";
import type { PreEtsSettingsRow } from "./pre-ets-settings";
import { resolvePreEtsWorksheetServiceFields } from "./pre-ets-settings";
import type { ParsedWorksheetGroup, ParsedWorksheetStudent } from "./pre-ets-worksheet-parser";
import { normalizeWorksheetHeaderKeyLoose } from "./pre-ets-worksheet-parser";

export type AuthMatchStats = {
  authorizationsMatched: number;
  authorizationsCreated: number;
  rosterEntriesUpdated: number;
  unmatchedStudents: Array<{ participantId: string; fullName: string; reason: string }>;
  /** Schools whose primary staff assignment was set from a matched spreadsheet instructor. */
  instructorSchoolsAssigned: number;
  /** Spreadsheet instructor names skipped (no Transition Specialist / Instructor profile). */
  instructorNamesIgnored: number;
  pendingAuthsRemaining: number;
};

export type AuthMatchWarning = {
  kind: "unmatched_student" | "pending_auth_remaining";
  message: string;
  participantId?: string;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function findProgramGroupId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  groupName: string,
  instructorName?: string | null
): Promise<string | null> {
  const { data: rows } = await admin
    .from("pre_ets_program_groups")
    .select("id, instructor_name")
    .eq("school_id", schoolId)
    .eq("service_month", serviceMonth)
    .eq("group_name", groupName)
    .order("created_at", { ascending: false });

  const matches = rows ?? [];
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0]!.id as string;

  const instructorKey = instructorName?.trim()
    ? normalizeWorksheetHeaderKeyLoose(instructorName)
    : "";
  if (instructorKey) {
    const byInstructor = matches.find(
      (row) =>
        normalizeWorksheetHeaderKeyLoose(String(row.instructor_name ?? "")) === instructorKey
    );
    if (byInstructor?.id) return byInstructor.id as string;
  }

  return null;
}

export async function findPendingGroupAuthorizationId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  programGroupId: string,
  worksheetHeaderKey?: string | null
): Promise<string | null> {
  let query = admin
    .from("pre_ets_authorizations")
    .select("id")
    .eq("school_id", schoolId)
    .eq("service_month", serviceMonth)
    .eq("program_group_id", programGroupId)
    .is("auth_number", null)
    .eq("auth_type", "pending")
    .order("created_at", { ascending: false })
    .limit(1);

  const headerKey = worksheetHeaderKey?.trim() ?? "";
  if (headerKey) {
    query = query.eq("worksheet_header_key", headerKey);
  }

  const { data } = await query.maybeSingle();

  return (data?.id as string) ?? null;
}

export async function findPendingIndividualAuthorizationId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  schoolYear: string,
  participantId: string,
  programGroupId: string,
  worksheetHeaderKey?: string | null
): Promise<string | null> {
  const headerKey = worksheetHeaderKey?.trim() ?? "";
  const { data: student } = await admin
    .from("pre_ets_students")
    .select("id")
    .eq("participant_id", participantId)
    .eq("school_year", schoolYear)
    .maybeSingle();

  if (!student?.id) return null;

  const { data: rosterRows } = await admin
    .from("pre_ets_roster_entries")
    .select(
      "authorization_id, pre_ets_authorizations(id, auth_number, auth_type, school_id, service_month, program_group_id, worksheet_header_key)"
    )
    .eq("student_id", student.id as string);

  for (const row of rosterRows ?? []) {
    const auth = relationOne(
      row.pre_ets_authorizations as
        | {
            id: string;
            auth_number: string | null;
            auth_type: string;
            school_id: string;
            service_month: string;
            program_group_id: string | null;
            worksheet_header_key: string | null;
          }
        | {
            id: string;
            auth_number: string | null;
            auth_type: string;
            school_id: string;
            service_month: string;
            program_group_id: string | null;
            worksheet_header_key: string | null;
          }[]
        | null
    );
    if (
      auth &&
      auth.school_id === schoolId &&
      auth.service_month === serviceMonth &&
      auth.program_group_id === programGroupId &&
      (!headerKey || auth.worksheet_header_key === headerKey) &&
      !auth.auth_number &&
      (auth.auth_type === "pending" || auth.auth_type === "individual")
    ) {
      return auth.id;
    }
  }

  return null;
}

export async function countPendingAuthorizationsForDistrictMonth(
  admin: SupabaseClient,
  districtId: string,
  serviceMonth: string
): Promise<number> {
  const { data: schools } = await admin
    .from("pre_ets_schools")
    .select("id")
    .eq("district_id", districtId);

  const schoolIds = (schools ?? []).map((s) => s.id as string);
  if (!schoolIds.length) return 0;

  const { count } = await admin
    .from("pre_ets_authorizations")
    .select("id", { count: "exact", head: true })
    .in("school_id", schoolIds)
    .eq("service_month", serviceMonth)
    .is("auth_number", null)
    .eq("auth_type", "pending");

  return count ?? 0;
}

export type ResolveAuthorizationInput = {
  schoolId: string;
  serviceMonth: string;
  schoolYear: string;
  programGroupId: string;
  worksheetHeaderKey: string;
  group: ParsedWorksheetGroup;
  students: ParsedWorksheetStudent[];
  first: ParsedWorksheetStudent;
  authType: "group" | "individual" | "pending";
  settings: Pick<PreEtsSettingsRow, "service_codes">;
};

export type ResolveAuthorizationResult = {
  authId: string;
  matchedPending: boolean;
  createdNew: boolean;
};

export async function resolveAuthorizationForWorksheetRow(
  admin: SupabaseClient,
  input: ResolveAuthorizationInput
): Promise<ResolveAuthorizationResult | null> {
  const {
    schoolId,
    serviceMonth,
    schoolYear,
    programGroupId,
    worksheetHeaderKey,
    group,
    first,
    authType,
    settings,
  } = input;

  const headerKey = worksheetHeaderKey.trim();

  const { serviceCode, serviceLabel } = resolvePreEtsWorksheetServiceFields(
    first.serviceCode || group.serviceCode,
    first.service || group.serviceLabel,
    settings
  );

  if (first.authNumber) {
    const { data: existingByNumber } = await admin
      .from("pre_ets_authorizations")
      .select("id")
      .eq("school_id", schoolId)
      .eq("service_month", serviceMonth)
      .eq("program_group_id", programGroupId)
      .eq("auth_number", first.authNumber)
      .maybeSingle();

    if (existingByNumber?.id) {
      await admin
        .from("pre_ets_authorizations")
        .update({
          auth_type: authType === "pending" ? "pending" : authType,
          service_code: serviceCode,
          service_label: serviceLabel,
          program_group_id: programGroupId,
          worksheet_header_key: headerKey || null,
        })
        .eq("id", existingByNumber.id);

      return {
        authId: existingByNumber.id as string,
        matchedPending: false,
        createdNew: false,
      };
    }

    if (authType !== "pending") {
      let pendingId: string | null = null;

      if (authType === "group") {
        pendingId = await findPendingGroupAuthorizationId(
          admin,
          schoolId,
          serviceMonth,
          programGroupId,
          headerKey
        );
      } else if (authType === "individual") {
        pendingId = await findPendingIndividualAuthorizationId(
          admin,
          schoolId,
          serviceMonth,
          schoolYear,
          first.participantId,
          programGroupId,
          headerKey
        );
      }

      if (pendingId) {
        await admin
          .from("pre_ets_authorizations")
          .update({
            auth_number: first.authNumber,
            auth_type: authType,
            service_code: serviceCode,
            service_label: serviceLabel,
            program_group_id: programGroupId,
            worksheet_header_key: headerKey || null,
          })
          .eq("id", pendingId);

        return { authId: pendingId, matchedPending: true, createdNew: false };
      }
    }

    const { data: created, error } = await admin
      .from("pre_ets_authorizations")
      .insert({
        program_group_id: programGroupId,
        school_id: schoolId,
        service_month: serviceMonth,
        auth_number: first.authNumber,
        auth_type: authType === "pending" ? "pending" : authType,
        service_code: serviceCode,
        service_label: serviceLabel,
        worksheet_header_key: headerKey || null,
        status: "active",
      })
      .select("id")
      .single();

    if (error || !created) return null;
    return {
      authId: created.id as string,
      matchedPending: false,
      createdNew: true,
    };
  }

  let pendingId: string | null = null;
  if (authType === "individual") {
    pendingId = await findPendingIndividualAuthorizationId(
      admin,
      schoolId,
      serviceMonth,
      schoolYear,
      first.participantId,
      programGroupId,
      headerKey
    );
  } else {
    pendingId = await findPendingGroupAuthorizationId(
      admin,
      schoolId,
      serviceMonth,
      programGroupId,
      headerKey
    );
  }

  if (pendingId) {
    await admin
      .from("pre_ets_authorizations")
      .update({
        service_code: serviceCode,
        service_label: serviceLabel,
        program_group_id: programGroupId,
        worksheet_header_key: headerKey || null,
      })
      .eq("id", pendingId);

    return { authId: pendingId, matchedPending: true, createdNew: false };
  }

  const { data: created, error } = await admin
    .from("pre_ets_authorizations")
    .insert({
      program_group_id: programGroupId,
      school_id: schoolId,
      service_month: serviceMonth,
      auth_number: null,
      auth_type: "pending",
      service_code: serviceCode,
      service_label: serviceLabel,
      worksheet_header_key: headerKey || null,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return { authId: created.id as string, matchedPending: false, createdNew: true };
}
