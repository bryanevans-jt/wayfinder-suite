import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { clientDisplayName } from "@wayfinder/branding";
import type { CounselorClientCard } from "@/components/counselor-clients-grid";
import {
  fetchCounselorAssignedClients,
  getCounselorPortalAdmin,
} from "@/lib/counselor-portal-data";
import { formatPortalDateTime } from "@/lib/portal-datetime";
import { counselorDisplayStatus } from "@wayfinder/supabase/referral-labels";
import { createServerClient } from "@wayfinder/supabase";

export async function loadCounselorClientGridCards(
  counselorId: string,
  authUserId: string | undefined,
  options: { includeArchived?: boolean } = {}
): Promise<{
  clients: Awaited<ReturnType<typeof fetchCounselorAssignedClients>>["clients"];
  cards: CounselorClientCard[];
  error: string | null;
  devHint: string | null;
}> {
  const { includeArchived = false } = options;
  const { clients, error, devHint } = await fetchCounselorAssignedClients(
    counselorId,
    authUserId,
    { includeArchived }
  );

  if (error) {
    return { clients: [], cards: [], error, devHint };
  }

  const admin = getCounselorPortalAdmin();
  const dataClient = admin ?? (await createServerClient());

  const fkClientIds = [...new Set(clients.flatMap((c) => c.activityFkIds))];
  const fkToLinkId = new Map<string, string>();
  for (const c of clients) {
    for (const fk of c.activityFkIds) {
      fkToLinkId.set(fk, c.linkId);
    }
  }
  const userIds = [
    ...new Set(
      clients
        .flatMap((c) => [c.user_id, c.profile_id] as (string | null)[])
        .filter(Boolean) as string[]
    ),
  ];
  const stageIds = [
    ...new Set(clients.map((c) => c.current_stage_id).filter(Boolean) as string[]),
  ];

  const [{ data: profiles }, { data: milestones }, { data: applications }, { data: logs }] =
    await Promise.all([
      userIds.length
        ? dataClient
            .from("profiles")
            .select("id, full_name, first_name, last_name")
            .in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; full_name: string | null }[] }),
      stageIds.length
        ? dataClient.from("service_milestones").select("id, title").in("id", stageIds)
        : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      fkClientIds.length
        ? dataClient
            .from("applications")
            .select("client_id, status, created_at")
            .in("client_id", fkClientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({
            data: [] as { client_id: string; status: string | null; created_at: string }[],
          }),
      fkClientIds.length
        ? dataClient
            .from("contact_logs")
            .select("client_id, created_at")
            .in("client_id", fkClientIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as { client_id: string; created_at: string }[] }),
    ]);

  const nameByUser = new Map(
    (profiles ?? []).map((p) => {
      const row = p as {
        id: string;
        full_name: string | null;
        first_name?: string | null;
        last_name?: string | null;
      };
      const name =
        (row.full_name ?? "").trim() ||
        [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
        null;
      return [row.id, name];
    })
  );
  const stageTitle = new Map((milestones ?? []).map((m) => [m.id, m.title]));

  const appCount = new Map<string, number>();
  const latestAppByClient = new Map<string, { status: string | null; created_at: string }>();
  for (const row of applications ?? []) {
    const cid = fkToLinkId.get(row.client_id as string) ?? (row.client_id as string);
    appCount.set(cid, (appCount.get(cid) ?? 0) + 1);
    if (!latestAppByClient.has(cid)) {
      latestAppByClient.set(cid, {
        status: row.status as string | null,
        created_at: row.created_at as string,
      });
    }
  }

  const lastLogAt = new Map<string, string>();
  for (const row of logs ?? []) {
    const cid = fkToLinkId.get(row.client_id as string) ?? (row.client_id as string);
    if (!lastLogAt.has(cid)) {
      lastLogAt.set(cid, row.created_at as string);
    }
  }

  const cards: CounselorClientCard[] = clients.map((c) => {
    const profileUserId = (c.user_id ?? c.profile_id) as string | null;
    const displayName = clientDisplayName({
      full_name: (profileUserId ? nameByUser.get(profileUserId) : null) ?? c.full_name ?? null,
      contact_email: c.contact_email,
      id: c.linkId,
    });
    const stage = counselorDisplayStatus({
      intakeStatus: c.intake_status,
      stageTitle:
        c.current_stage_id && stageTitle.has(c.current_stage_id as string)
          ? (stageTitle.get(c.current_stage_id as string) ?? null)
          : null,
    });
    const last = lastLogAt.get(c.linkId);
    const latest = latestAppByClient.get(c.linkId);
    return {
      linkId: c.linkId,
      displayName,
      stageLabel: stage,
      applicationCount: appCount.get(c.linkId) ?? 0,
      lastActivityLabel: last ? formatPortalDateTime(last) : "—",
      latestStatus: latest?.status ?? null,
    };
  });

  return { clients, cards, error: null, devHint };
}
