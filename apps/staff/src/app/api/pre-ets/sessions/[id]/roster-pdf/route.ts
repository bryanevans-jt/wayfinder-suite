import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { generatePreEtsRosterPdf } from "@/lib/pre-ets-roster-pdf";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

type AuthRow = {
  auth_number: string | null;
  service_code: string;
  service_label: string | null;
  auth_type: string;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/roster-pdf";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const url = new URL(request.url);
  const sessionDate = url.searchParams.get("sessionDate");

  try {
    const admin = createServiceRoleClient();
    const { data: session, error: sessErr } = await admin
      .from("pre_ets_sessions")
      .select(
        "id, session_date, instructor_name, authorization_id, pre_ets_authorizations(auth_number, service_code, service_label, auth_type), pre_ets_schools(name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (sessErr || !session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const authId = session.authorization_id as string;
    const authRow = relationOne(session.pre_ets_authorizations as AuthRow | AuthRow[] | null);
    const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);

    const { data: rosterEntries } = await admin
      .from("pre_ets_roster_entries")
      .select("list_order, pre_ets_students(participant_id, full_name)")
      .eq("authorization_id", authId)
      .eq("not_approved", false)
      .order("list_order", { ascending: true });

    const students =
      (rosterEntries ?? [])
        .map((row) => {
          const st = relationOne(
            row.pre_ets_students as
              | { participant_id: string; full_name: string }
              | { participant_id: string; full_name: string }[]
              | null
          );
          if (!st) return null;
          return { participantId: st.participant_id, fullName: st.full_name };
        })
        .filter((s): s is { participantId: string; fullName: string } => s !== null) ?? [];

    const pdfBytes = await generatePreEtsRosterPdf({
      authorizationNumber: authRow?.auth_number ?? "",
      sessionDate: sessionDate ?? (session.session_date as string | null),
      schoolName: school?.name ?? "",
      instructorName: (session.instructor_name as string) ?? "",
      topic: authRow?.service_label ?? "",
      serviceCode: authRow?.service_code ?? "",
      students,
    });

    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-ets-roster-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
