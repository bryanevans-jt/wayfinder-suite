import type { SupabaseClient } from "@supabase/supabase-js";

export async function seedSessionAttendance(
  admin: SupabaseClient,
  sessionId: string,
  authorizationId: string
): Promise<void> {
  const { data: entries } = await admin
    .from("pre_ets_roster_entries")
    .select("id, student_id")
    .eq("authorization_id", authorizationId)
    .eq("not_approved", false);

  if (!entries?.length) return;

  const rows = entries.map((e) => ({
    session_id: sessionId,
    student_id: e.student_id as string,
    roster_entry_id: e.id as string,
    present: false,
    signed_on_roster: false,
  }));

  await admin
    .from("pre_ets_session_attendance")
    .upsert(rows, { onConflict: "session_id,student_id", ignoreDuplicates: true });
}

export async function maybeCompleteSessionDocumentation(
  admin: SupabaseClient,
  sessionId: string,
  schoolYear: string
): Promise<boolean> {
  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select("status, signed_roster_drive_file_id, documentation_completed_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (
    !session ||
    session.status !== "scheduled" ||
    session.documentation_completed_at ||
    !session.signed_roster_drive_file_id
  ) {
    return false;
  }

  const { data: car } = await admin
    .from("pre_ets_activity_reports")
    .select("status")
    .eq("session_id", sessionId)
    .maybeSingle();

  const carDone =
    car?.status === "submitted" || car?.status === "late_submitted";
  if (!carDone) return false;

  await admin
    .from("pre_ets_sessions")
    .update({
      status: "completed",
      documentation_completed_at: new Date().toISOString(),
    })
    .eq("id", sessionId);

  await applyBillableAttendance(admin, sessionId, schoolYear);
  return true;
}

export async function applyBillableAttendance(
  admin: SupabaseClient,
  sessionId: string,
  schoolYear: string
): Promise<void> {
  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select("billable_units_applied_at")
    .eq("id", sessionId)
    .maybeSingle();

  if (session?.billable_units_applied_at) return;

  const { data: presentRows } = await admin
    .from("pre_ets_session_attendance")
    .select("student_id")
    .eq("session_id", sessionId)
    .eq("present", true)
    .eq("signed_on_roster", true);

  for (const row of presentRows ?? []) {
    const studentId = row.student_id as string;
    const { data: ytd } = await admin
      .from("pre_ets_student_ytd_units")
      .select("id, billable_units")
      .eq("student_id", studentId)
      .eq("school_year", schoolYear)
      .maybeSingle();

    if (ytd?.id) {
      await admin
        .from("pre_ets_student_ytd_units")
        .update({
          billable_units: ((ytd.billable_units as number) ?? 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", ytd.id);
    } else {
      await admin.from("pre_ets_student_ytd_units").insert({
        student_id: studentId,
        school_year: schoolYear,
        billable_units: 1,
      });
    }
  }

  await admin
    .from("pre_ets_sessions")
    .update({ billable_units_applied_at: new Date().toISOString() })
    .eq("id", sessionId);
}
