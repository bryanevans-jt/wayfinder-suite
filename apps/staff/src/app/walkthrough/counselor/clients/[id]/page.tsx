import { ClientActivityTimeline, isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_COUNSELOR_FEEDS, getDemoClient } from "../../../lib/counselor-mock-data";

type PageProps = { params: Promise<{ id: string }> };

export default async function CounselorDemoClientPage({ params }: PageProps) {
  const { id } = await params;
  const client = getDemoClient(id);
  if (!client) {
    notFound();
  }

  const feed = DEMO_COUNSELOR_FEEDS[id] ?? [];
  const gold = isGoldApplicationStatus(client.latestAppStatus);

  return (
    <main className="px-6 py-10">
      <Link
        href="/walkthrough/counselor"
        className="text-sm font-medium text-brand-green hover:underline"
      >
        ← Back to client grid
      </Link>

      <header className="mt-6 max-w-3xl border-b border-neutral-200 pb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-brand-green">{client.displayName}</h1>
            <p className="mt-2 text-sm text-brand-black/80">
              <span className="font-medium text-brand-green">Current stage</span> · {client.stage}
            </p>
          </div>
          {gold && client.latestAppStatus ? (
            <span className="rounded-full bg-brand-gold px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              {client.latestAppStatus}
            </span>
          ) : null}
        </div>
      </header>

      <section className="mx-auto max-w-3xl py-10">
        <h2 className="text-lg font-semibold text-brand-green">Activity Timeline</h2>
        <p className="mt-1 text-sm text-brand-black/70">
          Contact notes, job applications, milestone updates, and confirmed upcoming meetings,
          oldest first. This view is read-only.
        </p>
        <ClientActivityTimeline
          feed={feed}
          emptyMessage="No contact logs, applications, milestone events, or upcoming meetings yet for this client."
        />
      </section>
    </main>
  );
}
