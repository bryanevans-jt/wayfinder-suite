import { createServerClient } from "@wayfinder/supabase";
import { createServiceRoleClient } from "@wayfinder/supabase/admin-server";
import { clientDisplayName, isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CounselorHistoryPreferenceToggle } from "@/components/counselor-history-preference-toggle";
import { CounselorServiceHistorySections } from "@/components/counselor-service-history-sections";
import { StaffSupportNote } from "@/components/staff-support-note";
import { requireCounselorSession } from "@/lib/app-session";
import {
  fetchCounselorClientForActivity,
  getCounselorPortalAdmin,
} from "@/lib/counselor-portal-data";
import {
  loadCounselorServiceHistoryContext,
  loadCounselorShowHistoryPreference,
} from "@/lib/counselor-service-history-data";

type PageProps = { params: Promise<{ id: string }> };

export default async function CounselorClientActivityPage({ params }: PageProps) {
  const { id: clientId } = await params;

  const { session, counselorRow } = await requireCounselorSession();
  if (!counselorRow) {
    notFound();
  }

  const { client, error: clientLoadError } = await fetchCounselorClientForActivity(
    counselorRow.id,
    clientId,
    session.effectiveUserId
  );

  if (!client) {
    if (clientLoadError) {
      return (
        <main className="px-6 py-10">
          <Link
            href="/dashboard/counselor"
            className="text-sm font-medium text-brand-green hover:underline"
          >
            ← Back to client grid
          </Link>
          <div className="mt-8 max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50/80 p-5">
            <h1 className="text-lg font-semibold text-brand-black">Could Not Load This Client</h1>
            <p className="text-sm text-red-900">{clientLoadError}</p>
            <StaffSupportNote />
          </div>
        </main>
      );
    }
    notFound();
  }

  const showHistory = await loadCounselorShowHistoryPreference(session.effectiveUserId);
  const { activeEpisodes, priorEpisodes } = await loadCounselorServiceHistoryContext(
    client.linkId,
    showHistory
  );

  const admin = getCounselorPortalAdmin() ?? createServiceRoleClient();
  const dataClient = admin ?? (await createServerClient());

  const clientProfileUserId = (client.user_id ?? client.profile_id) as string | null;

  const { data: clientProfile } = clientProfileUserId
    ? await dataClient
        .from("profiles")
        .select("full_name, first_name, last_name")
        .eq("id", clientProfileUserId)
        .maybeSingle()
    : { data: null };

  const { data: clientRow } = await dataClient
    .from("clients")
    .select("full_name, authorization_number")
    .eq("id", client.linkId)
    .maybeSingle();

  const displayName = clientDisplayName({
    full_name: clientProfile?.full_name ?? client.full_name ?? clientRow?.full_name ?? null,
    first_name: clientProfile?.first_name ?? null,
    last_name: clientProfile?.last_name ?? null,
    contact_email: client.contact_email,
    id: client.linkId,
  });

  const { data: currentMs } = client.current_stage_id
    ? await dataClient
        .from("service_milestones")
        .select("title")
        .eq("id", client.current_stage_id)
        .maybeSingle()
    : { data: null as { title: string } | null };

  const { data: applications } = await dataClient
    .from("applications")
    .select("status, created_at")
    .in("client_id", client.activityFkIds)
    .order("created_at", { ascending: false })
    .limit(1);

  const latestApp = applications?.[0];
  const gold = isGoldApplicationStatus(latestApp?.status as string | undefined);

  return (
    <main className="px-6 py-10">
      <Link
        href="/dashboard/counselor"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to client grid
      </Link>

      <header className="mt-6 max-w-3xl border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-brand-green">{displayName}</h1>
            <p className="mt-2 text-sm text-brand-black/80">
              <span className="font-medium text-brand-green">Current stage</span> ·{" "}
              {currentMs?.title ?? "—"}
              {clientRow?.authorization_number ? (
                <>
                  {" "}
                  · Auth{" "}
                  <span className="font-medium">{String(clientRow.authorization_number)}</span>
                </>
              ) : null}
            </p>
          </div>
          {gold ? (
            <span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {String(latestApp?.status)}
            </span>
          ) : null}
        </div>

        <div className="mt-4 max-w-lg">
          <CounselorHistoryPreferenceToggle initialShowHistory={showHistory} />
        </div>
      </header>

      <section className="mx-auto max-w-3xl py-10" aria-labelledby="counselor-activity-heading">
        <h2 id="counselor-activity-heading" className="text-lg font-semibold text-brand-green">
          Service activity
        </h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Contact notes and milestone updates grouped by authorization. Active services are shown
          first; prior services appear when history is enabled. This view is read-only.
        </p>
        <div className="mt-6">
          <CounselorServiceHistorySections
            currentClientId={client.linkId}
            activeEpisodes={activeEpisodes}
            priorEpisodes={priorEpisodes}
            showHistory={showHistory}
          />
        </div>
      </section>

      <footer className="mx-auto max-w-3xl border-t border-neutral-100 pt-6">
        <StaffSupportNote />
      </footer>
    </main>
  );
}
