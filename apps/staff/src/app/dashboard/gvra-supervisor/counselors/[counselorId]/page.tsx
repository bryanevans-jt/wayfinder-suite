import Link from "next/link";
import { Suspense } from "react";
import { CounselorClientsGrid } from "@/components/counselor-clients-grid";
import { StaffSupportNote } from "@/components/staff-support-note";
import { ViewArchivedToggle } from "@/components/view-archived-toggle";
import {
  requireGvraSupervisorCounselorAccess,
  requireGvraSupervisorSession,
} from "@/lib/app-session";
import { loadCounselorClientGridCards } from "@/lib/counselor-client-grid-data";

type PageProps = {
  params: Promise<{ counselorId: string }>;
  searchParams: Promise<{ archived?: string }>;
};

export default async function GvraSupervisorCounselorClientsPage({
  params,
  searchParams,
}: PageProps) {
  const { counselorId } = await params;
  const { archived } = await searchParams;
  const includeArchived = archived === "1";

  const { session } = await requireGvraSupervisorSession();
  const { counselorRow } = await requireGvraSupervisorCounselorAccess(session, counselorId);

  const loginUserId = (counselorRow.user_id as string | null) ?? undefined;
  const { cards, error, devHint } = await loadCounselorClientGridCards(
    counselorRow.id,
    loginUserId,
    { includeArchived }
  );

  return (
    <main className="px-6 py-10" aria-labelledby="gvra-counselor-clients-heading">
      <Link
        href="/dashboard/gvra-supervisor"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to counselors
      </Link>

      <header className="mt-6 max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Counselor caseload
        </p>
        <h1
          id="gvra-counselor-clients-heading"
          className="mt-1 text-3xl font-semibold text-brand-green"
        >
          {counselorRow.full_name}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/80">
          Clients assigned to this counselor. This view matches what the counselor sees in their
          portal — read-only activity and status only.
          {includeArchived ? (
            <> Showing archived clients (Closed or Dismissed).</>
          ) : (
            <> Archived clients are hidden unless you turn on View archived.</>
          )}
        </p>
        <Suspense fallback={null}>
          <ViewArchivedToggle className="mt-4" />
        </Suspense>
      </header>

      {error ? (
        <div className="mt-10 max-w-xl space-y-4 rounded-xl border border-red-200 bg-red-50/80 p-5">
          <p className="text-sm text-red-900">{error}</p>
          <StaffSupportNote />
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-10 max-w-xl space-y-3 text-brand-black/75">
          <p>No clients are assigned to this counselor yet.</p>
          {process.env.NODE_ENV === "development" && devHint ? (
            <p className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-xs text-brand-black/60">
              Dev: {devHint}
            </p>
          ) : null}
          <StaffSupportNote />
        </div>
      ) : (
        <CounselorClientsGrid
          clients={cards}
          getClientHref={(linkId) =>
            `/dashboard/gvra-supervisor/counselors/${counselorId}/clients/${linkId}`
          }
        />
      )}
    </main>
  );
}
