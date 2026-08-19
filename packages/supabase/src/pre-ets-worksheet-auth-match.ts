import type { SupabaseClient } from "@supabase/supabase-js";
import type { ParsedWorksheetGroup, ParsedWorksheetStudent } from "./pre-ets-worksheet-parser";

export type AuthMatchStats = {
  authorizationsMatched: number;
  authorizationsCreated: number;
  rosterEntriesUpdated: number;
  unmatchedStudents: Array<{ participantId: string; fullName: string; reason: string }>;
  pendingAuthsRemaining: number;
};

export type AuthMatchWarning = {
  kind: "unmatched_student" | "pending_auth_remaining" | "missing_planning";
  message: string;
  participantId?: string;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function assertPlanningCommittedForAuthMatch(
  admin: SupabaseClient,
  districtNumber: string,
  schoolYear: string,
  serviceMonth: string
): Promise<{ ok: true; districtId: string } | { ok: false; error: string }> {
  const { data: district } = await admin
    .from("pre_ets_districts")
    .select("id")
    .eq("gvra_district_number", districtNumber)
    .eq("school_year", schoolYear)
    .maybeSingle();

  if (!district?.id) {
    return {
      ok: false,
      error:
        "No Phase 1 planning data found for this district and school year. Commit a planning import first.",
    };
  }

  const { data: planningImport } = await admin
    .from("pre_ets_worksheet_imports")
    .select("id")
    .eq("district_id", district.id)
    .eq("service_month", serviceMonth)
    .eq("phase", "planning")
    .eq("status", "committed")
    .order("committed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!planningImport) {
    return {
      ok: false,
      error:
        "Phase 2 auth match requires a committed Phase 1 planning import for this district and service month.",
    };
  }

  return { ok: true, districtId: district.id as string };
}

export async function findProgramGroupId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  groupName: string
): Promise<string | null> {
  const { data } = await admin
    .from("pre_ets_program_groups")
    .select("id")
    .eq("school_id", schoolId)
    .eq("service_month", serviceMonth)
    .eq("group_name", groupName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.id as string) ?? null;
}

export async function findPendingGroupAuthorizationId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  programGroupId: string
): Promise<string | null> {
  const { data } = await admin
    .from("pre_ets_authorizations")
    .select("id")
    .eq("school_id", schoolId)
    .eq("service_month", serviceMonth)
    .eq("program_group_id", programGroupId)
    .is("auth_number", null)
    .eq("auth_type", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data?.id as string) ?? null;
}

export async function findPendingIndividualAuthorizationId(
  admin: SupabaseClient,
  schoolId: string,
  serviceMonth: string,
  schoolYear: string,
  participantId: string
): Promise<string | null> {
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
      "authorization_id, pre_ets_authorizations(id, auth_number, auth_type, school_id, service_month)"
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
          }
        | {
            id: string;
            auth_number: string | null;
            auth_type: string;
            school_id: string;
            service_month: string;
          }[]
        | null
    );
    if (
      auth &&
      auth.school_id === schoolId &&
      auth.service_month === serviceMonth &&
      !auth.auth_number &&
      auth.auth_type === "pending"
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
  phase: "planning" | "auth_match";
  schoolId: string;
  serviceMonth: string;
  schoolYear: string;
  programGroupId: string;
  group: ParsedWorksheetGroup;
  students: ParsedWorksheetStudent[];
  first: ParsedWorksheetStudent;
  authType: "group" | "individual" | "pending";
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
  const { phase, schoolId, serviceMonth, schoolYear, programGroupId, group, first, authType } =
    input;

  const serviceCode = first.serviceCode || group.serviceCode || "UNKNOWN";
  const serviceLabel = first.service || group.serviceLabel;

  if (first.authNumber) {
    const { data: existingByNumber } = await admin
      .from("pre_ets_authorizations")
      .select("id")
      .eq("school_id", schoolId)
      .eq("service_month", serviceMonth)
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
        })
        .eq("id", existingByNumber.id);

      return {
        authId: existingByNumber.id as string,
        matchedPending: false,
        createdNew: false,
      };
    }

    if (phase === "auth_match" && authType !== "pending") {
      let pendingId: string | null = null;

      if (authType === "group") {
        pendingId = await findPendingGroupAuthorizationId(
          admin,
          schoolId,
          serviceMonth,
          programGroupId
        );
      } else if (authType === "individual") {
        pendingId = await findPendingIndividualAuthorizationId(
          admin,
          schoolId,
          serviceMonth,
          schoolYear,
          first.participantId
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

  if (phase === "auth_match") {
    let pendingId: string | null = null;
    if (authType === "individual") {
      pendingId = await findPendingIndividualAuthorizationId(
        admin,
        schoolId,
        serviceMonth,
        schoolYear,
        first.participantId
      );
    } else {
      pendingId = await findPendingGroupAuthorizationId(
        admin,
        schoolId,
        serviceMonth,
        programGroupId
      );
    }

    if (pendingId) {
      await admin
        .from("pre_ets_authorizations")
        .update({
          service_code: serviceCode,
          service_label: serviceLabel,
          program_group_id: programGroupId,
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
      auth_number: null,
      auth_type: "pending",
      service_code: serviceCode,
      service_label: serviceLabel,
      status: "active",
    })
    .select("id")
    .single();

  if (error || !created) return null;
  return { authId: created.id as string, matchedPending: false, createdNew: true };
}
