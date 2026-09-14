import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePreEtsServiceLabel, type PreEtsSettingsRow } from "@wayfinder/supabase/pre-ets-settings";
import { buildPreEtsRosterPdf } from "@/lib/pre-ets-roster-export";
import { generatePreEtsRosterPdf, type RosterPdfInput } from "@/lib/pre-ets-roster-pdf";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

type AuthRow = {
  auth_number: string | null;
  service_code: string;
  service_label: string | null;
  auth_type: string;
};

export async function loadSessionRosterPdfInput(
  admin: SupabaseClient,
  sessionId: string,
  opts?: { sessionDateOverride?: string | null; includeCapturedSignatures?: boolean }
): Promise<RosterPdfInput | null> {
  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select(
      "id, session_date, instructor_name, authorization_id, pre_ets_authorizations(auth_number, service_code, service_label, auth_type), pre_ets_schools(name)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session?.authorization_id) return null;

  const authId = session.authorization_id as string;
  const authRow = relationOne(session.pre_ets_authorizations as AuthRow | AuthRow[] | null);
  const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);

  const signatureByStudentId = new Map<
    string,
    { signatureDataUrl: string; signedDate: string | null }
  >();

  if (opts?.includeCapturedSignatures) {
    const { data: attendance } = await admin
      .from("pre_ets_session_attendance")
      .select("student_id, roster_signature_data, roster_signed_date")
      .eq("session_id", sessionId);

    for (const row of attendance ?? []) {
      const sig = row.roster_signature_data as string | null;
      if (sig?.startsWith("data:image/")) {
        signatureByStudentId.set(row.student_id as string, {
          signatureDataUrl: sig,
          signedDate: (row.roster_signed_date as string | null) ?? null,
        });
      }
    }
  }

  const { data: rosterEntries } = await admin
    .from("pre_ets_roster_entries")
    .select("student_id, list_order, pre_ets_students(id, participant_id, full_name)")
    .eq("authorization_id", authId)
    .eq("not_approved", false)
    .order("list_order", { ascending: true });

  const students =
    (rosterEntries ?? [])
      .map((row) => {
        const st = relationOne(
          row.pre_ets_students as
            | { id: string; participant_id: string; full_name: string }
            | { id: string; participant_id: string; full_name: string }[]
            | null
        );
        if (!st) return null;
        const captured = signatureByStudentId.get(st.id);
        return {
          participantId: st.participant_id,
          fullName: st.full_name,
          signatureDataUrl: captured?.signatureDataUrl ?? null,
          signedDate: captured?.signedDate ?? null,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null) ?? [];

  const authType = authRow?.auth_type as "group" | "individual" | "pending" | undefined;
  const pdfStudents =
    authType === "individual" && students.length > 0 ? [students[0]] : students;

  return {
    authorizationNumber: authRow?.auth_number ?? "",
    authType,
    sessionDate:
      opts?.sessionDateOverride ??
      (session.session_date as string | null) ??
      null,
    schoolName: school?.name ?? "",
    instructorName: (session.instructor_name as string) ?? "",
    topic: "",
    serviceCode: authRow?.service_code ?? "",
    students: pdfStudents,
  };
}

export async function buildSessionRosterPdfBytes(
  admin: SupabaseClient,
  sessionId: string,
  settings: PreEtsSettingsRow,
  opts?: { sessionDateOverride?: string | null; includeCapturedSignatures?: boolean }
): Promise<Uint8Array | null> {
  const input = await loadSessionRosterPdfInput(admin, sessionId, opts);
  if (!input) return null;

  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select("pre_ets_authorizations(service_label)")
    .eq("id", sessionId)
    .maybeSingle();
  const authRow = relationOne(
    session?.pre_ets_authorizations as { service_label: string | null } | { service_label: string | null }[] | null
  );

  input.topic = resolvePreEtsServiceLabel(
    input.serviceCode,
    authRow?.service_label ?? null,
    settings
  );

  const hasCapturedSignatures = input.students.some((s) => s.signatureDataUrl?.startsWith("data:image/"));
  if (hasCapturedSignatures) {
    return generatePreEtsRosterPdf(input);
  }

  return buildPreEtsRosterPdf(input, settings);
}
