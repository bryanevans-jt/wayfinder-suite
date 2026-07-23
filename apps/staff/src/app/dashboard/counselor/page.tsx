import { createServerClient } from "@wayfinder/supabase";
import { clientDisplayName } from "@wayfinder/branding";
import Link from "next/link";
import { Suspense } from "react";
import { CounselorClientsGrid } from "@/components/counselor-clients-grid";
import { StaffSupportNote } from "@/components/staff-support-note";
import { ViewArchivedToggle } from "@/components/view-archived-toggle";
import { STAFF_SUPPORT_EMAIL, STAFF_SUPPORT_MAILTO } from "@/lib/support-contact";
import { requireCounselorSession } from "@/lib/app-session";
import {
  fetchCounselorAssignedClients,
  getCounselorPortalAdmin,
} from "@/lib/counselor-portal-data";
import { formatPortalDateTime } from "@/lib/portal-datetime";

export default async function CounselorPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const { archived } = await searchParams;
  const includeArchived = archived === "1";

  const { session, counselorRow } = await requireCounselorSession();

  if (!counselorRow) {
    return (
      <main className="px-6 py-10">
        <header className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
            Counselor portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-green">Setup Needed</h1>
          <p className="mt-3 text-brand-black/85">
            Your account hasn&apos;t been set up yet. Contact{" "}
            <a
              href={STAFF_SUPPORT_MAILTO}
              className="font-medium text-brand-green underline underline-offset-2 hover:text-brand-green/80"
            >
              {STAFF_SUPPORT_EMAIL}
            </a>{" "}
            for access.
          </p>
        </header>
      </main>
    );
  }

  const { clients, error: clientsLoadError, devHint } = await fetchCounselorAssignedClients(
    counselorRow.id,
    session.effectiveUserId,
    { includeArchived }
  );

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

  return (
    <main className="px-6 py-10">
      <header className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Counselor portal
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-brand-green">Your Clients</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/80">
          Signed in as <span className="font-medium text-brand-black">{counselorRow.full_name}</span>
          . Open a card to see the full activity timeline. Check{" "}
          <span className="font-medium text-brand-black">Notifications</span> in the sidebar for
          weekly activity summaries and employment milestones. This portal is{" "}
          <span className="font-medium text-brand-black">view-only</span> — you cannot edit client
          records here.
          {includeArchived ? (
            <> Showing archived clients (Closed or Dismissed).</>
          ) : (
            <> Archived clients are hidden unless you turn on View archived.</>
          )}
          {session.isPreviewing ? (
            <> You are previewing this counselor workspace in read-only mode.</>
          ) : null}
        </p>
        <Suspense fallback={null}>
          <ViewArchivedToggle className="mt-4" />
        </Suspense>
        <p className="mt-3 text-sm">
          <Link href="/dashboard/counselor/quick-start" className="font-medium text-brand-green hover:underline">
            Quick Start Guide
          </Link>
          {" · "}
          <Link href="/dashboard/help" className="font-medium text-brand-green hover:underline">
            Help
          </Link>
        </p>
      </header>

      {clientsLoadError ? (
        <div className="mt-10 max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50/80 p-5">
          <p className="text-sm text-red-900">{clientsLoadError}</p>
          <StaffSupportNote />
        </div>
      ) : clients.length === 0 ? (
        <div className="mt-10 max-w-xl space-y-3 text-brand-black/75">
          <p>
            No clients are assigned to you yet. When an Employment Specialist assigns you on a
            client record, they will appear here.
          </p>
          {process.env.NODE_ENV === "development" && devHint ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-brand-black/60">
              Dev: {devHint}
            </p>
          ) : null}
          <StaffSupportNote />
        </div>
      ) : (
        <CounselorClientsGrid
          clients={clients.map((c) => {
            const profileUserId = (c.user_id ?? c.profile_id) as string | null;
            const displayName = clientDisplayName({
              full_name: (profileUserId ? nameByUser.get(profileUserId) : null) ?? c.full_name ?? null,
              contact_email: c.contact_email,
              id: c.linkId,
            });
            const stage =
              c.current_stage_id && stageTitle.has(c.current_stage_id as string)
                ? (stageTitle.get(c.current_stage_id as string) ?? "—")
                : "—";
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
          })}
        />
      )}

      {clients.length > 0 ? (
        <footer className="mt-12 max-w-5xl border-t border-neutral-100 pt-6">
          <StaffSupportNote />
        </footer>
      ) : null}
    </main>
  );
}
