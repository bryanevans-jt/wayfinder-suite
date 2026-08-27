"use client";

import { CounselorClientsGrid, type CounselorClientCard } from "@/components/counselor-clients-grid";
import { formatPortalDateTime } from "@wayfinder/branding";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_COUNSELOR, DEMO_COUNSELOR_CLIENTS } from "../lib/counselor-mock-data";

export function CounselorDemoHome() {
  const [showArchived, setShowArchived] = useState(false);

  const clients: CounselorClientCard[] = useMemo(
    () =>
      DEMO_COUNSELOR_CLIENTS.filter((c) => showArchived || !c.archived).map((c) => ({
        linkId: c.linkId,
        displayName: c.displayName,
        stageLabel: c.stage,
        applicationCount: c.applications,
        lastActivityLabel: formatPortalDateTime(c.lastActivity),
        latestStatus: c.latestAppStatus,
        serviceName: c.serviceName,
      })),
    [showArchived]
  );

  return (
    <main className="px-6 py-10" aria-labelledby="counselor-demo-heading">
      <header className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Counselor portal
        </p>
        <h1 id="counselor-demo-heading" className="mt-1 text-3xl font-semibold text-brand-green">
          Your Clients
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-brand-black/80">
          Signed in as{" "}
          <span className="font-medium text-brand-black">{DEMO_COUNSELOR.full_name}</span> (
          {DEMO_COUNSELOR.agency}). Open a card to see the full activity timeline. This portal is{" "}
          <span className="font-medium text-brand-black">view-only</span> — you cannot edit client
          records here.
        </p>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-brand-black/80">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300 text-brand-green focus:ring-brand-green"
          />
          View archived clients
        </label>
        <p className="mt-3 text-sm">
          <Link
            href="/walkthrough/counselor/quick-start"
            className="font-medium text-brand-green hover:underline"
          >
            Quick Start Guide
          </Link>
          {" · "}
          <Link
            href="/walkthrough/counselor/login"
            className="font-medium text-brand-green hover:underline"
          >
            Demo sign-in screen
          </Link>
        </p>
      </header>

      {clients.length === 0 ? (
        <p className="mt-10 text-sm text-brand-black/75">No clients match this view.</p>
      ) : (
        <CounselorClientsGrid
          clients={clients}
          getClientHref={(linkId) => `/walkthrough/counselor/clients/${linkId}`}
        />
      )}
    </main>
  );
}
