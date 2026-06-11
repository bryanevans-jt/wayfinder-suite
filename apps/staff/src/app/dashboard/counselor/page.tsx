import { createServerClient } from "@wayfinder/supabase";
import { clientDisplayName, isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";
import { StaffSupportNote } from "@/components/staff-support-note";
import { STAFF_SUPPORT_EMAIL, STAFF_SUPPORT_MAILTO } from "@/lib/support-contact";
import { requireCounselorSession } from "@/lib/app-session";
import {
  fetchCounselorAssignedClients,
  getCounselorPortalAdmin,
} from "@/lib/counselor-portal-data";
import { formatPortalDateTime } from "@/lib/portal-datetime";

export default async function CounselorPortalPage() {
  const { session, counselorRow } = await requireCounselorSession();

  if (!counselorRow) {
    return (
      <main className="px-6 py-10">
        <header className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
            Counselor portal
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-brand-green">Setup needed</h1>
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
    session.effectiveUserId
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
        <h1 className="mt-1 text-3xl font-semibold text-brand-green">Your clients</h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/80">
          Signed in as <span className="font-medium text-brand-black">{counselorRow.full_name}</span>
          . Open a card to see the full activity timeline. This portal is{" "}
          <span className="font-medium text-brand-black">view-only</span> — you cannot edit client
          records here.
          {session.isPreviewing ? (
            <> You are previewing this counselor workspace in read-only mode.</>
          ) : null}
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
            No clients are assigned to you yet. When an employment specialist assigns you on a
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
        <ul className="mt-10 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const profileUserId = (c.user_id ?? c.profile_id) as string;
            const displayName = clientDisplayName({
              full_name: nameByUser.get(profileUserId) ?? null,
              contact_email: c.contact_email,
              id: c.linkId,
            });
            const stage =
              c.current_stage_id && stageTitle.has(c.current_stage_id as string)
                ? stageTitle.get(c.current_stage_id as string)
                : "—";
            const apps = appCount.get(c.linkId) ?? 0;
            const last = lastLogAt.get(c.linkId);
            const latest = latestAppByClient.get(c.linkId);
            const gold = isGoldApplicationStatus(latest?.status);

            return (
              <li key={c.linkId}>
                <Link
                  href={`/dashboard/counselor/clients/${c.linkId}`}
                  className="block h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-green/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-brand-black">{displayName}</h2>
                    {gold ? (
                      <span className="shrink-0 rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                        {latest?.status}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-brand-black/70">
                    <span className="font-medium text-brand-green">Current stage</span> · {stage}
                  </p>
                  <dl className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm text-brand-black/80">
                    <div className="flex justify-between gap-2">
                      <dt>Applications submitted</dt>
                      <dd className="font-semibold text-brand-black">{apps}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Last activity</dt>
                      <dd className="text-right text-brand-black">
                        {last ? formatPortalDateTime(last) : "—"}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {clients.length > 0 ? (
        <footer className="mt-12 max-w-5xl border-t border-neutral-100 pt-6">
          <StaffSupportNote />
        </footer>
      ) : null}
    </main>
  );
}
