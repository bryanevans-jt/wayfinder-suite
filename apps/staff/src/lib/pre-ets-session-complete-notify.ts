import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { loadPreEtsSettings } from "@wayfinder/supabase/pre-ets-settings";
import { buildPreEtsCarPdf } from "@/lib/pre-ets-car-export";
import { downloadDriveFileBytes } from "@/lib/pre-ets-drive-download";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";
import {
  loadPreEtsAccountsSpecialistUserIds,
  loadPreEtsSchoolSupervisorUserId,
} from "@wayfinder/supabase/pre-ets-compliance";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

function relationOne<T>(raw: T | T[] | null | undefined): T | null {
  if (!raw) return null;
  return Array.isArray(raw) ? (raw[0] ?? null) : raw;
}

async function loadStaffEmail(admin: AdminClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email.trim().toLowerCase();
}

function sessionLabel(opts: {
  schoolName: string;
  sessionDate: string | null;
  authNumber: string | null;
}): string {
  return `${opts.schoolName || "School"} · ${opts.sessionDate ?? "Date TBD"} · Auth ${opts.authNumber ?? "—"}`;
}

export async function notifyPreEtsSessionCompleted(
  admin: AdminClient,
  sessionId: string
): Promise<{ emailed: number; notified: number }> {
  const settings = await loadPreEtsSettings(admin);

  const { data: session } = await admin
    .from("pre_ets_sessions")
    .select(
      "id, session_date, instructor_name, school_id, signed_roster_drive_file_id, signed_roster_drive_file_name, pre_ets_schools(name), pre_ets_authorizations(auth_number, service_code), pre_ets_activity_reports(*)"
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (!session?.signed_roster_drive_file_id) {
    return { emailed: 0, notified: 0 };
  }

  const report = relationOne(
    session.pre_ets_activity_reports as Record<string, unknown> | Record<string, unknown>[] | null
  );
  if (!report) {
    return { emailed: 0, notified: 0 };
  }

  const authRow = relationOne(
    session.pre_ets_authorizations as
      | { auth_number: string | null; service_code: string }
      | { auth_number: string | null; service_code: string }[]
      | null
  );
  const school = relationOne(session.pre_ets_schools as { name: string } | { name: string }[] | null);
  const schoolName = school?.name ?? "";
  const label = sessionLabel({
    schoolName,
    sessionDate: session.session_date as string | null,
    authNumber: authRow?.auth_number ?? null,
  });

  const recipientIds = new Set<string>();
  for (const id of await loadPreEtsAccountsSpecialistUserIds(admin)) {
    recipientIds.add(id);
  }
  const supervisorId = await loadPreEtsSchoolSupervisorUserId(
    admin,
    session.school_id as string | null
  );
  if (supervisorId) {
    recipientIds.add(supervisorId);
  }

  if (recipientIds.size === 0) {
    return { emailed: 0, notified: 0 };
  }

  let carPdf: Uint8Array | null = null;
  if (settings.template_car_doc_id) {
    try {
      carPdf = await buildPreEtsCarPdf(
        {
          sessionDate: (report.session_date as string | null) ?? (session.session_date as string | null),
          schoolName,
          authNumber: authRow?.auth_number ?? "",
          instructorName: (session.instructor_name as string) ?? "",
          serviceCode: authRow?.service_code ?? "",
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
    } catch (err) {
      console.error("pre_ets completion CAR pdf failed:", err);
    }
  }

  const rosterBytes = await downloadDriveFileBytes(
    session.signed_roster_drive_file_id as string
  );

  const rosterFileName =
    (session.signed_roster_drive_file_name as string | null)?.trim() ||
    `signed-roster-${sessionId.slice(0, 8)}.pdf`;
  const carFileName = `activity-plan-${sessionId.slice(0, 8)}.pdf`;

  const attachments: {
    filename: string;
    content: string;
    encoding: "base64";
    mimeType?: string;
  }[] = [];

  if (rosterBytes?.length) {
    attachments.push({
      filename: rosterFileName.endsWith(".pdf") ? rosterFileName : `${rosterFileName}.pdf`,
      content: Buffer.from(rosterBytes).toString("base64"),
      encoding: "base64",
      mimeType: "application/pdf",
    });
  }
  if (carPdf?.length) {
    attachments.push({
      filename: carFileName,
      content: Buffer.from(carPdf).toString("base64"),
      encoding: "base64",
      mimeType: "application/pdf",
    });
  }

  const emailBody = [
    `Pre-ETS session documentation is complete.`,
    "",
    label,
    `Instructor: ${(session.instructor_name as string) ?? "—"}`,
    "",
    "Attached: signed roster and Class Activity Report (Activity Plan).",
    "",
    "View sessions in Wayfinder Pro → Pre-ETS.",
  ].join("\n");

  let emailed = 0;
  let notified = 0;
  let gauth: Awaited<ReturnType<typeof getGoogleAuth>> | null = null;

  for (const userId of recipientIds) {
    await notifyUser(admin, {
      userId,
      app: "staff",
      kind: "pre_ets_session_complete",
      title: "Pre-ETS session documentation complete",
      body: `${label} — signed roster and Activity Plan are ready for billing review.`,
      link_path: "/dashboard/pre-ets?tab=sessions",
      metadata: { sessionId },
    });
    notified++;

    const email = await loadStaffEmail(admin, userId);
    if (!email) continue;

    try {
      gauth ??= await getGoogleAuth();
      await sendEmail(gauth, {
        to: email,
        subject: `Pre-ETS session complete — ${schoolName} · ${session.session_date ?? ""}`,
        text: emailBody,
        attachments: attachments.length ? attachments : undefined,
      });
      emailed++;
    } catch (err) {
      console.error(`pre_ets completion email failed for ${userId}:`, err);
    }
  }

  return { emailed, notified };
}
