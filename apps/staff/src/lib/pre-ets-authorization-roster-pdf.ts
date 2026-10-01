import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import {
  lookupPreEtsServiceCode,
  resolvePreEtsServiceLabel,
  sanitizePreEtsServiceCodeText,
  type PreEtsSettingsRow,
} from "@wayfinder/supabase/pre-ets-settings";
import { buildPreEtsRosterFileLabel } from "@wayfinder/supabase/pre-ets-roster-filename";
import { buildPreEtsRosterPdf } from "@/lib/pre-ets-roster-export";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export type AuthorizationRosterPdfBuildResult =
  | {
      ok: true;
      pdfBytes: Uint8Array;
      fileLabel: string;
      studentCount: number;
    }
  | { ok: false; error: string; skip?: boolean };

export async function buildAuthorizationRosterPdf(
  admin: AdminClient,
  authorizationId: string,
  settings: Pick<
    PreEtsSettingsRow,
    "template_roster_doc_id" | "template_individual_roster_doc_id" | "service_codes"
  >,
  options?: { sessionDate?: string | null }
): Promise<AuthorizationRosterPdfBuildResult> {
  const { data: authorization, error } = await admin
    .from("pre_ets_authorizations")
    .select(
      "id, auth_number, auth_type, service_code, service_label, service_month, pre_ets_schools(name, pre_ets_districts(school_year)), pre_ets_program_groups(group_name, instructor_name)"
    )
    .eq("id", authorizationId)
    .maybeSingle();

  if (error || !authorization) {
    return { ok: false, error: error?.message ?? "Authorization not found" };
  }

  const school = relationOne(
    authorization.pre_ets_schools as
      | { name: string; pre_ets_districts: { school_year: string } | { school_year: string }[] | null }
      | { name: string; pre_ets_districts: { school_year: string } | { school_year: string }[] | null }[]
      | null
  );
  const district = relationOne(school?.pre_ets_districts ?? null);
  const group = relationOne(
    authorization.pre_ets_program_groups as
      | { group_name: string; instructor_name: string | null }
      | { group_name: string; instructor_name: string | null }[]
      | null
  );

  const { data: rosterEntries } = await admin
    .from("pre_ets_roster_entries")
    .select("list_order, not_approved, pre_ets_students(participant_id, full_name)")
    .eq("authorization_id", authorizationId)
    .eq("not_approved", false)
    .order("list_order", { ascending: true });

  const students = (rosterEntries ?? [])
    .map((row) => {
      if (row.not_approved) return null;
      const st = relationOne(
        row.pre_ets_students as
          | { participant_id: string; full_name: string }
          | { participant_id: string; full_name: string }[]
          | null
      );
      if (!st?.participant_id?.trim()) return null;
      return { participantId: st.participant_id.trim(), fullName: st.full_name ?? "" };
    })
    .filter((s): s is { participantId: string; fullName: string } => s !== null);

  if (students.length === 0) {
    return { ok: false, error: "No roster students with PID", skip: true };
  }

  const authType = authorization.auth_type as "group" | "individual" | "pending";
  const pdfStudents =
    authType === "individual" && students.length > 0 ? [students[0]] : students;

  const rawServiceCode = (authorization.service_code as string) ?? "";
  const catalogRow = lookupPreEtsServiceCode(rawServiceCode, settings);
  const serviceCode = catalogRow?.code ?? sanitizePreEtsServiceCodeText(rawServiceCode);
  const topic = resolvePreEtsServiceLabel(
    serviceCode,
    authorization.service_label as string | null,
    settings
  );

  const pdfBytes = await buildPreEtsRosterPdf(
    {
      authorizationNumber: (authorization.auth_number as string | null) ?? "",
      authType,
      sessionDate: options?.sessionDate ?? null,
      schoolName: school?.name ?? "",
      instructorName: group?.instructor_name ?? "",
      topic,
      serviceCode,
      students: pdfStudents,
    },
    settings
  );

  const fileLabel = buildPreEtsRosterFileLabel({
    schoolYear: district?.school_year ?? null,
    serviceMonth: (authorization.service_month as string | null) ?? null,
    schoolName: school?.name ?? "School",
    groupName: group?.group_name ?? "Group",
    sessionDate: options?.sessionDate ?? null,
  });

  return {
    ok: true,
    pdfBytes,
    fileLabel,
    studentCount: pdfStudents.length,
  };
}
