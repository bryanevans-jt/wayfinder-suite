"use client";

import { formatPortalDateTime, isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";
import { useMemo, useState } from "react";
import { DEMO_COUNSELOR, DEMO_COUNSELOR_CLIENTS } from "../lib/counselor-mock-data";

export function CounselorDemoHome() {
  const [showArchived, setShowArchived] = useState(false);

  const clients = useMemo(
    () => DEMO_COUNSELOR_CLIENTS.filter((c) => showArchived || !c.archived),
    [showArchived]
  );

  return (
    <main className="px-6 py-10">
      <header className="max-w-5xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-green">
          Counselor portal
        </p>
        <h1 className="mt-1 text-3xl font-semibold text-brand-green">Your clients</h1>
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
            Quick start guide
          </Link>
        </p>
      </header>

      {clients.length === 0 ? (
        <p className="mt-10 text-sm text-brand-black/75">No clients match this view.</p>
      ) : (
        <ul className="mt-10 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {clients.map((c) => {
            const gold = isGoldApplicationStatus(c.latestAppStatus);
            return (
              <li key={c.linkId}>
                <Link
                  href={`/walkthrough/counselor/clients/${c.linkId}`}
                  className="block h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-green/40 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold text-brand-black">{c.displayName}</h2>
                    {gold && c.latestAppStatus ? (
                      <span className="shrink-0 rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                        {c.latestAppStatus}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-brand-black/70">
                    <span className="font-medium text-brand-green">Current stage</span> · {c.stage}
                  </p>
                  <dl className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm text-brand-black/80">
                    <div className="flex justify-between gap-2">
                      <dt>Applications submitted</dt>
                      <dd className="font-semibold text-brand-black">{c.applications}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Last activity</dt>
                      <dd className="text-right text-brand-black">
                        {formatPortalDateTime(c.lastActivity)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
