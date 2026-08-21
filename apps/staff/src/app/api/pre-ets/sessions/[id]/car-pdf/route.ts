import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { buildPreEtsCarPdf } from "@/lib/pre-ets-car-export";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/car-pdf";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data: session, error: sessErr } = await admin
      .from("pre_ets_sessions")
      .select(
        "id, session_date, instructor_name, pre_ets_authorizations(auth_number, service_code, service_label), pre_ets_schools(name), pre_ets_activity_reports(*)"
      )
      .eq("id", id)
      .maybeSingle();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const report = relationOne(
      session.pre_ets_activity_reports as Record<string, unknown> | Record<string, unknown>[] | null
    );
    if (!report) {
      return NextResponse.json({ error: "Activity report not found" }, { status: 404 });
    }

    const authRow = relationOne(
      session.pre_ets_authorizations as
        | { auth_number: string | null; service_code: string; service_label: string | null }
        | { auth_number: string | null; service_code: string; service_label: string | null }[]
        | null
    );
    const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);
    const settings = await loadPreEtsSettings(admin);
    const serviceCode = authRow?.service_code ?? "";

    const pdfBytes = await buildPreEtsCarPdf(
      {
        sessionDate: (report.session_date as string | null) ?? (session.session_date as string | null),
        schoolName: school?.name ?? "",
        authNumber: authRow?.auth_number ?? "",
        instructorName: (session.instructor_name as string) ?? "",
        serviceCode,
        lessonTopic: (report.lesson_topic as string | null) ?? null,
        learningObjective: (report.learning_objective as string | null) ?? null,
        lessonStructure: (report.lesson_structure as string | null) ?? null,
        participantCount:
          typeof report.participant_count === "number" ? report.participant_count : null,
        studentsOnTime: (report.students_on_time as boolean | null) ?? null,
        studentsEngaged: (report.students_engaged as boolean | null) ?? null,
        studentsParticipated: (report.students_participated as boolean | null) ?? null,
        studentsDisruptive: (report.students_disruptive as boolean | null) ?? null,
        facultyPresent: (report.faculty_present as boolean | null) ?? null,
        additionalNotes: (report.additional_notes as string | null) ?? null,
        signatureData: (report.signature_data as string | null) ?? null,
        signedDate: (report.signed_date as string | null) ?? null,
      },
      settings,
      admin
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-ets-car-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
