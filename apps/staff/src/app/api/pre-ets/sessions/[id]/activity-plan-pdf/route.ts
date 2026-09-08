import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { blankCarPdfInput, buildPreEtsCarPdf } from "@/lib/pre-ets-car-export";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

/** Blank Class Activity Report / Activity Plan for paper fill-out before class. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/activity-plan-pdf";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;

  try {
    const admin = createServiceRoleClient();
    const { data: session, error: sessErr } = await admin
      .from("pre_ets_sessions")
      .select(
        "id, session_date, instructor_name, pre_ets_authorizations(auth_number, service_code, service_label), pre_ets_schools(name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const authRow = relationOne(
      session.pre_ets_authorizations as
        | { auth_number: string | null; service_code: string; service_label: string | null }
        | { auth_number: string | null; service_code: string; service_label: string | null }[]
        | null
    );
    const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);
    const settings = await loadPreEtsSettings(admin);

    const pdfBytes = await buildPreEtsCarPdf(
      blankCarPdfInput({
        sessionDate: session.session_date as string | null,
        schoolName: school?.name ?? "",
        authNumber: authRow?.auth_number ?? "",
        instructorName: (session.instructor_name as string) ?? "",
        serviceCode: authRow?.service_code ?? "",
      }),
      settings,
      admin
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-ets-activity-plan-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
