"use client";

import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import { isGoldApplicationStatus } from "@wayfinder/branding";
import Link from "next/link";

export type CounselorClientCard = {
  linkId: string;
  displayName: string;
  stageLabel: string;
  applicationCount: number;
  lastActivityLabel: string;
  latestStatus: string | null;
};

type Props = {
  clients: CounselorClientCard[];
};

export function CounselorClientsGrid({ clients }: Props) {
  const { pageSize, setPageSize, page, setPage, totalPages, pageItems, totalCount } =
    useClientListPagination(clients);

  return (
    <div className="mt-10 space-y-4">
      <ClientListPaginationControls
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />
      <ul className="grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {pageItems.map((c) => {
          const gold = isGoldApplicationStatus(c.latestStatus);
          return (
            <li key={c.linkId}>
              <Link
                href={`/dashboard/counselor/clients/${c.linkId}`}
                className="block h-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-brand-green/40 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold text-brand-black">{c.displayName}</h2>
                  {gold ? (
                    <span className="shrink-0 rounded-full bg-brand-gold px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-white">
                      {c.latestStatus}
                    </span>
                  ) : null}
                </div>
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
    </div>
  );
}
