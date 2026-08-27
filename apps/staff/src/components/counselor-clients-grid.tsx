"use client";

import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import { isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";
import { useMemo, useState } from "react";

export type CounselorClientCard = {
  linkId: string;
  displayName: string;
  stageLabel: string;
  applicationCount: number;
  lastActivityLabel: string;
  latestStatus: string | null;
  /** Optional service track shown under the stage (demo + live when available). */
  serviceName?: string | null;
};

type Props = {
  clients: CounselorClientCard[];
  /** Override client detail links (e.g. walkthrough). Default: live counselor portal. */
  getClientHref?: (linkId: string) => string;
};

function lastNameSortKey(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0].toLowerCase();
  return parts[parts.length - 1].toLowerCase();
}

function compareByLastName(a: CounselorClientCard, b: CounselorClientCard): number {
  const lastCmp = lastNameSortKey(a.displayName).localeCompare(lastNameSortKey(b.displayName), undefined, {
    sensitivity: "base",
  });
  if (lastCmp !== 0) return lastCmp;
  return a.displayName.trim().localeCompare(b.displayName.trim(), undefined, { sensitivity: "base" });
}

export function CounselorClientsGrid({ clients, getClientHref }: Props) {
  const [query, setQuery] = useState("");

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = !q
      ? clients
      : clients.filter((c) => {
          const haystack = [c.displayName, c.stageLabel, c.serviceName, c.latestStatus]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });
    return [...matched].sort(compareByLastName);
  }, [clients, query]);

  const { pageSize, setPageSize, page, setPage, totalPages, pageItems, totalCount } =
    useClientListPagination(filteredClients);

  function hrefFor(linkId: string) {
    return getClientHref?.(linkId) ?? `/dashboard/counselor/clients/${linkId}`;
  }

  const searching = query.trim().length > 0;
  const resultsSummary = searching
    ? `${totalCount} client${totalCount === 1 ? "" : "s"} match your search`
    : `${totalCount} client${totalCount === 1 ? "" : "s"} listed alphabetically by last name`;

  return (
    <div className="mt-10 space-y-4">
      <div className="flex max-w-xl flex-col gap-2">
        <label className="sr-only" htmlFor="counselor-client-search">
          Search clients by name, stage, or service
        </label>
        <input
          id="counselor-client-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, stage, or service…"
          autoComplete="off"
          aria-controls="counselor-client-caseload"
          aria-describedby="counselor-client-search-status"
          className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-brand-black"
        />
        <p id="counselor-client-search-status" className="sr-only" role="status" aria-live="polite">
          {resultsSummary}
        </p>
      </div>

      {totalCount === 0 ? (
        <p className="text-sm text-brand-black/75" role="status">
          {searching ? "No clients match your search." : "No clients to show."}
        </p>
      ) : (
        <>
          <ClientListPaginationControls
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
          <ul
            id="counselor-client-caseload"
            className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3"
            aria-label="Client caseload, alphabetical by last name"
          >
            {pageItems.map((c) => {
              const gold = isGoldApplicationStatus(c.latestStatus);
              const statusPart = c.latestStatus ? `, status ${c.latestStatus}` : "";
              const servicePart = c.serviceName ? `, ${c.serviceName}` : "";
              return (
                <li key={c.linkId}>
                  <Link
                    href={hrefFor(c.linkId)}
                    aria-label={`${c.displayName}, current stage ${c.stageLabel}${servicePart}${statusPart}`}
                    className="block h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-green/40 hover:shadow-md focus-visible:border-brand-green"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h2 className="text-lg font-semibold text-brand-black">{c.displayName}</h2>
                      {gold && c.latestStatus ? (
                        <span className="shrink-0 rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                          {c.latestStatus}
                        </span>
                      ) : null}
                    </div>
                    {c.serviceName ? (
                      <p className="mt-1 text-xs font-medium text-brand-black/55">{c.serviceName}</p>
                    ) : null}
                    <p className="mt-2 text-sm text-brand-black/70">
                      <span className="font-medium text-brand-green">Current stage</span> · {c.stageLabel}
                    </p>
                    <dl className="mt-4 space-y-1 border-t border-neutral-100 pt-4 text-sm text-brand-black/80">
                      <div className="flex justify-between gap-2">
                        <dt>Applications submitted</dt>
                        <dd className="font-semibold text-brand-black">{c.applicationCount}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Last activity</dt>
                        <dd className="text-right text-brand-black">{c.lastActivityLabel}</dd>
                      </div>
                    </dl>
                  </Link>
                </li>
              );
            })}
          </ul>
          <ClientListPaginationControls
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
