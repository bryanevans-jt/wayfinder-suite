import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { generatePreEtsRosterPdf } from "@/lib/pre-ets-roster-pdf";
import { NextResponse } from "next/server";

type AuthRow = {
  auth_number: string | null;
  auth_type: string;
  service_code: string;
  service_label: string | null;
  pre_ets_schools: { name: string } | { name: string }[] | null;
  pre_ets_program_groups: { instructor_name: string | null } | { instructor_name: string | null }[] | null;
};

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const route = "api/pre-ets/authorizations/[id]/roster-pdf";
  const auth = await requirePreEtsApi("access");
  if (isPreEtsApiError(auth)) return auth;

  const { id } = await context.params;
  const url = new URL(request.url);
  const sessionDate = url.searchParams.get("sessionDate");

  try {
    const admin = createServiceRoleClient();
    const { data: authorization, error } = await admin
      .from("pre_ets_authorizations")
      .select(
        "id, auth_number, auth_type, service_code, service_label, pre_ets_schools(name), pre_ets_program_groups(instructor_name)"
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !authorization) {
      return NextResponse.json({ error: "Authorization not found" }, { status: 404 });
    }

    const authRow = authorization as AuthRow;
    const school = relationOne(authRow.pre_ets_schools);
    const group = relationOne(authRow.pre_ets_program_groups);

    const { data: rosterEntries } = await admin
      .from("pre_ets_roster_entries")
      .select("list_order, pre_ets_students(participant_id, full_name)")
      .eq("authorization_id", id)
      .eq("not_approved", false)
      .order("list_order", { ascending: true });

    const students = (rosterEntries ?? [])
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
      .filter((s): s is { participantId: string; fullName: string } => s !== null);

    const authType = authRow.auth_type as "group" | "individual" | "pending";
    const pdfStudents =
      authType === "individual" && students.length > 0 ? [students[0]] : students;

    const pdfBytes = await generatePreEtsRosterPdf({
      authorizationNumber: authRow.auth_number ?? "",
      authType,
      sessionDate,
      schoolName: school?.name ?? "",
      instructorName: group?.instructor_name ?? "",
      topic: authRow.service_label ?? "",
      serviceCode: authRow.service_code ?? "",
      students: pdfStudents,
    });

    const suffix = authType === "individual" ? "individual" : "group";
    return new NextResponse(Buffer.from(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="pre-ets-roster-${suffix}-${id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
