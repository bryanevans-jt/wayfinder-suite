import type { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { formatEnglishList } from "@wayfinder/supabase/pre-ets-list-format";
import { notifyUser } from "@wayfinder/supabase/notify-user";
import { getGoogleAuth, sendEmail } from "@/lib/google-mail";

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function loadStaffEmail(admin: AdminClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user?.email) return null;
  return data.user.email.trim().toLowerCase();
}

/**
 * Batch in-app + email for instructors when next-month rosters release on the 20th.
 * Sends nothing when there are no schools / recipients.
 */
export async function deliverPreEtsBatchRosterReleaseNotices(
  admin: AdminClient,
  input: {
    serviceMonth: string;
    recipientSchoolLabels: Map<string, string[]>;
  }
): Promise<{ notified: number; emailed: number }> {
  const monthLabel = input.serviceMonth.slice(0, 7);
  if (input.recipientSchoolLabels.size === 0) {
    return { notified: 0, emailed: 0 };
  }

  let notified = 0;
  let emailed = 0;
  let gauth: Awaited<ReturnType<typeof getGoogleAuth>> | null = null;
  try {
    gauth = await getGoogleAuth();
  } catch (err) {
    console.error("pre-ets batch release: Google auth unavailable for email", err);
  }

  for (const [userId, schools] of input.recipientSchoolLabels) {
    const labels = [...new Set(schools.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    if (labels.length === 0) continue;

    const schoolList = formatEnglishList(labels);
    const title = `Pre-ETS rosters ready for ${monthLabel}`;
    const body = `Rosters are available for ${schoolList}. You can schedule sessions and print sign-in sheets (authorization numbers may still be pending).`;
    const link_path = `/dashboard/pre-ets?tab=authorizations&month=${encodeURIComponent(monthLabel)}`;

    await notifyUser(admin, {
      userId,
      app: "staff",
      kind: "pre_ets_roster_batch_released",
      title,
      body,
      link_path,
      metadata: { serviceMonth: input.serviceMonth, schools: labels },
    });
    notified++;

    if (!gauth) continue;
    const email = await loadStaffEmail(admin, userId);
    if (!email) continue;
    try {
      await sendEmail(gauth, {
        to: email,
        subject: title,
        text: [
          body,
          "",
          `Open Pre-ETS: ${process.env.NEXT_PUBLIC_STAFF_APP_URL ?? ""}${link_path}`,
        ].join("\n"),
      });
      emailed++;
    } catch (err) {
      console.error("pre-ets batch release email failed:", err);
    }
  }

  return { notified, emailed };
}
