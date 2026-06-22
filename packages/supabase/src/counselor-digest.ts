import type { createServiceRoleClient } from "./admin-server";
import { buildClientActivityFkIds } from "./client-activity-fk";
import { notifyUser } from "./notify-user";

export type CounselorDigestResult = {
  counselors: number;
  notified: number;
  skipped: number;
};

const DIGEST_KIND = "counselor_weekly_digest";
const DIGEST_WINDOW_DAYS = 7;

/** Weekly in-app summary for counselors — activity across assigned clients. */
export async function processCounselorWeeklyDigest(
  admin: ReturnType<typeof createServiceRoleClient>
): Promise<CounselorDigestResult> {
  const since = new Date();
  since.setDate(since.getDate() - DIGEST_WINDOW_DAYS);
  const sinceIso = since.toISOString();

  const { data: counselors, error } = await admin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "counselor")
    .eq("is_active", true);

  if (error) {
    throw new Error(error.message);
  }

  let notified = 0;
  let skipped = 0;

  for (const counselor of counselors ?? []) {
    const counselorUserId = counselor.id as string;

    const { data: recentDigest } = await admin
      .from("in_app_notifications")
      .select("id")
      .eq("user_id", counselorUserId)
      .eq("kind", DIGEST_KIND)
      .gte("created_at", sinceIso)
      .limit(1);

    if (recentDigest?.length) {
      skipped++;
      continue;
    }

    const { data: counselorRow } = await admin
      .from("counselors")
      .select("id")
      .eq("profile_id", counselorUserId)
      .maybeSingle();
    const counselorRowId = (counselorRow?.id as string | undefined) ?? counselorUserId;

    const { data: clientRows } = await admin
      .from("clients")
      .select("id, user_id, profile_id")
      .or(`counselor_id.eq.${counselorUserId},counselor_id.eq.${counselorRowId}`);

    if (!clientRows?.length) {
      skipped++;
      continue;
    }

    const fkClientIds = [
      ...new Set(clientRows.flatMap((row) => buildClientActivityFkIds(row))),
    ];

    const [{ count: contactCount }, { count: applicationCount }] = await Promise.all([
      admin
        .from("contact_logs")
        .select("id", { count: "exact", head: true })
        .in("client_id", fkClientIds)
        .gte("created_at", sinceIso),
      admin
        .from("applications")
        .select("id", { count: "exact", head: true })
        .in("client_id", fkClientIds)
        .gte("created_at", sinceIso),
    ]);

    const contacts = contactCount ?? 0;
    const applications = applicationCount ?? 0;

    if (contacts === 0 && applications === 0) {
      skipped++;
      continue;
    }

    const parts: string[] = [];
    if (contacts > 0) {
      parts.push(`${contacts} new contact log${contacts === 1 ? "" : "s"}`);
    }
    if (applications > 0) {
      parts.push(`${applications} job application${applications === 1 ? "" : "s"}`);
    }

    await notifyUser(admin, {
      userId: counselorUserId,
      kind: DIGEST_KIND,
      title: "Your weekly client summary",
      body: `Across ${clientRows.length} client${clientRows.length === 1 ? "" : "s"}: ${parts.join(" and ")}.`,
      link_path: "/dashboard/counselor",
      metadata: {
        client_count: clientRows.length,
        contact_count: contacts,
        application_count: applications,
        window_days: DIGEST_WINDOW_DAYS,
      },
      app: "staff",
    });

    notified++;
  }

  return {
    counselors: counselors?.length ?? 0,
    notified,
    skipped,
  };
}
