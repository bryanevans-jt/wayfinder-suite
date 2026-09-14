import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { respondWithLoggedError } from "@wayfinder/supabase/error-log";
import { validateRosterSignatureDataUrl } from "@/lib/pre-ets-roster-signature-validation";
import { isPreEtsApiError, requirePreEtsApi } from "@/lib/pre-ets-api-auth";
import { NextResponse } from "next/server";

type Body = {
  signatureData?: string | null;
  signedDate?: string | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; attendanceId: string }> }
) {
  const route = "api/pre-ets/sessions/[id]/attendance/[attendanceId]/roster-signature";
  const auth = await requirePreEtsApi("deliver");
  if (isPreEtsApiError(auth)) return auth;

  const { id: sessionId, attendanceId } = await context.params;

  try {
    const body = (await request.json()) as Body;
    const sigErr = validateRosterSignatureDataUrl(body.signatureData);
    if (sigErr) {
      return NextResponse.json({ error: sigErr }, { status: 400 });
    }

    const admin = createServiceRoleClient();
    const { data: row } = await admin
      .from("pre_ets_session_attendance")
      .select("id, session_id")
      .eq("id", attendanceId)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (!row) {
      return NextResponse.json({ error: "Attendance row not found." }, { status: 404 });
    }

    const signatureData =
      body.signatureData === null || body.signatureData === undefined || body.signatureData === ""
        ? null
        : body.signatureData.trim();

    const signedDate =
      signatureData && body.signedDate?.trim()
        ? body.signedDate.trim().slice(0, 10)
        : signatureData
          ? new Date().toISOString().slice(0, 10)
          : null;

    const { error } = await admin
      .from("pre_ets_session_attendance")
      .update({
        roster_signature_data: signatureData,
        roster_signed_date: signedDate,
        present: Boolean(signatureData),
        signed_on_roster: Boolean(signatureData),
      })
      .eq("id", attendanceId);

    if (error) {
      return respondWithLoggedError("staff", route, error, {
        userId: auth.userId,
        userRole: auth.role,
      });
    }

    return NextResponse.json({ ok: true, signedDate });
  } catch (err) {
    return respondWithLoggedError("staff", route, err, {
      userId: auth.userId,
      userRole: auth.role,
    });
  }
}
