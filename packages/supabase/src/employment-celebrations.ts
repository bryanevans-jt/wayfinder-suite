import type { createServiceRoleClient } from "./admin-server";
import { notifySupervisorsForEs } from "./notify-user";

export type EmploymentMilestone = "hire" | "day_30" | "day_60" | "day_90";

export const EMPLOYMENT_MILESTONE_DAYS: Record<EmploymentMilestone, number> = {
  hire: 0,
  day_30: 30,
  day_60: 60,
  day_90: 90,
};

export const CELEBRATION_COPY: Record<
  EmploymentMilestone,
  { title: string; body: string }
> = {
  hire: {
    title: "Congratulations on your new job",
    body: "Starting this role is a meaningful step. Your Joshua Tree team is proud of you and here if you need support.",
  },
  day_30: {
    title: "30 days of employment",
    body: "You have built a strong foundation in your new role. Keep up the great work.",
  },
  day_60: {
    title: "60 days of employment",
    body: "Two months in — steady progress worth celebrating. We are cheering you on.",
  },
  day_90: {
    title: "90 days of employment",
    body: "Three months employed is a major milestone. Well done.",
  },
};

function milestoneDueToday(jobStartDate: string, milestone: EmploymentMilestone, today: Date): boolean {
  const start = new Date(`${jobStartDate}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime())) return false;
  const due = new Date(start);
  due.setUTCDate(due.getUTCDate() + EMPLOYMENT_MILESTONE_DAYS[milestone]);
  return (
    due.getUTCFullYear() === today.getUTCFullYear() &&
    due.getUTCMonth() === today.getUTCMonth() &&
    due.getUTCDate() === today.getUTCDate()
  );
}

type AdminClient = ReturnType<typeof createServiceRoleClient>;

async function notifyUserCelebration(
  admin: AdminClient,
  input: {
    userId: string;
    app: "staff" | "client";
    milestone: EmploymentMilestone;
    clientId: string;
    clientLabel: string;
    linkPath: string;
  }
): Promise<void> {
  const copy = CELEBRATION_COPY[input.milestone];
  const { notifyUser } = await import("./notify-user");
  await notifyUser(admin, {
    userId: input.userId,
    app: input.app,
    kind: "employment_celebration",
    title: copy.title,
    body: copy.body,
    link_path: input.linkPath,
    metadata: {
      client_id: input.clientId,
      client_label: input.clientLabel,
      milestone: input.milestone,
    },
  });
}

export async function processEmploymentCelebration(
  admin: AdminClient,
  clientId: string,
  milestone: EmploymentMilestone,
  jobStartDate: string,
  clientLabel: string
): Promise<boolean> {
  const { data: existing } = await admin
    .from("client_employment_celebrations")
    .select("id")
    .eq("client_id", clientId)
    .eq("milestone", milestone)
    .maybeSingle();

  if (existing?.id) return false;

  const { error: insertErr } = await admin.from("client_employment_celebrations").insert({
    client_id: clientId,
    milestone,
    job_start_date: jobStartDate,
  });

  if (insertErr) {
    console.error("employment celebration insert failed:", insertErr.message);
    return false;
  }

  const copy = CELEBRATION_COPY[milestone];
  const clientLink = "/dashboard";
  const staffClientLink = `/dashboard/clients/${clientId}`;

  const { data: clientRow } = await admin
    .from("clients")
    .select("user_id, profile_id, counselor_id")
    .eq("id", clientId)
    .maybeSingle();

  const clientUserId = (clientRow?.user_id ?? clientRow?.profile_id) as string | null;
  if (clientUserId) {
    await notifyUserCelebration(admin, {
      userId: clientUserId,
      app: "client",
      milestone,
      clientId,
      clientLabel,
      linkPath: clientLink,
    });
  }

  const { data: esLinks } = await admin
    .from("es_client_assignments")
    .select("es_user_id")
    .eq("client_id", clientId);

  for (const link of esLinks ?? []) {
    const esUserId = link.es_user_id as string;
    await notifyUserCelebration(admin, {
      userId: esUserId,
      app: "staff",
      milestone,
      clientId,
      clientLabel,
      linkPath: staffClientLink,
    });
  }

  if (clientRow?.counselor_id) {
    const { data: counselor } = await admin
      .from("counselors")
      .select("user_id")
      .eq("id", clientRow.counselor_id as string)
      .maybeSingle();
    const counselorUserId = counselor?.user_id as string | null;
    if (counselorUserId) {
      await notifyUserCelebration(admin, {
        userId: counselorUserId,
        app: "staff",
        milestone,
        clientId,
        clientLabel,
        linkPath: `/dashboard/counselor/clients/${clientId}`,
      });
    }
  }

  const { data: supports } = await admin
    .from("natural_support_contacts")
    .select("support_user_id")
    .eq("client_id", clientId)
    .not("support_user_id", "is", null);

  for (const row of supports ?? []) {
    const supportUserId = row.support_user_id as string;
    await notifyUserCelebration(admin, {
      userId: supportUserId,
      app: "client",
      milestone,
      clientId,
      clientLabel,
      linkPath: `${clientLink}?client=${clientId}`,
    });
  }

  for (const link of esLinks ?? []) {
    const esUserId = link.es_user_id as string;
    await notifySupervisorsForEs(admin, esUserId, {
      app: "staff",
      kind: "employment_celebration",
      title: `${clientLabel}: ${copy.title}`,
      body: copy.body,
      link_path: staffClientLink,
      metadata: { client_id: clientId, milestone },
    });
  }

  return true;
}

export async function runDailyEmploymentCelebrations(
  admin: AdminClient,
  today = new Date()
): Promise<{ processed: number }> {
  const { data: clients, error } = await admin
    .from("clients")
    .select("id, job_start_date")
    .not("job_start_date", "is", null)
    .is("archived_at", null);

  if (error) {
    throw new Error(error.message);
  }

  let processed = 0;
  const milestones: EmploymentMilestone[] = ["day_30", "day_60", "day_90"];

  for (const row of clients ?? []) {
    const clientId = row.id as string;
    const jobStartDate = row.job_start_date as string;
    const { data: profile } = await admin
      .from("clients")
      .select("contact_email, user_id, profile_id")
      .eq("id", clientId)
      .maybeSingle();
    const clientLabel = (profile?.contact_email as string | null) ?? "Client";

    for (const milestone of milestones) {
      if (!milestoneDueToday(jobStartDate, milestone, today)) continue;
      const sent = await processEmploymentCelebration(
        admin,
        clientId,
        milestone,
        jobStartDate,
        clientLabel
      );
      if (sent) processed++;
    }
  }

  return { processed };
}
