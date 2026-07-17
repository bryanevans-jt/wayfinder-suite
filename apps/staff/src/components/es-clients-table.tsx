"use client";

import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import { CaseloadTriageIcons } from "@/components/caseload-triage-icons";
import {
  RESPONSIVE_TABLE_CLASS,
  ResponsiveTableShell,
} from "@/components/responsive-table-shell";
import { EsNaturalSupportButton } from "@/app/dashboard/clients/es-natural-support-button";
import type { CaseloadTriageFlag } from "@wayfinder/supabase/caseload-triage";
import Link from "next/link";

export type EsClientListRow = {
  id: string;
  displayName: string;
  serviceLabel: string;
  stageLabel: string;
  overdue: boolean;
  archived: boolean;
  triageFlags: CaseloadTriageFlag[];
};

type Props = {
  clients: EsClientListRow[];
  includeArchived: boolean;
  canManageSupport: boolean;
};

export function EsClientsTable({ clients, includeArchived, canManageSupport }: Props) {
  const { pageSize, setPageSize, page, setPage, totalPages, pageItems, totalCount } =
    useClientListPagination(clients);

  return (
    <div className="mt-8 space-y-3">
      <ClientListPaginationControls
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
        page={page}
        totalPages={totalPages}
        totalCount={totalCount}
        onPageChange={setPage}
      />
      <ResponsiveTableShell>
        <table className={RESPONSIVE_TABLE_CLASS}>
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50">
              <th className="px-4 py-3 font-semibold text-brand-black">Name</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Current service</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Current stage</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Messages</th>
              <th className="px-4 py-3 font-semibold text-brand-black">Support</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-brand-black/70">
                  {includeArchived
                    ? "No archived clients assigned to you."
                    : "No active clients assigned yet. Use Add client to create one, or turn on View archived."}
                </td>
              </tr>
            ) : (
              pageItems.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/80"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/dashboard/clients/${c.id}`}
                      className="font-medium text-brand-black underline decoration-brand-green/40 underline-offset-2 hover:decoration-brand-green"
                    >
                      {c.displayName}
                    </Link>
                    <CaseloadTriageIcons flags={c.triageFlags} />
                    {c.archived ? (
                      <span className="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs font-semibold uppercase text-brand-black/60">
                        Archived
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-brand-black">{c.serviceLabel}</td>
                  <td className="px-4 py-3 text-brand-black">{c.stageLabel}</td>
                  <td className="px-4 py-3">
                    {c.overdue ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold uppercase text-red-700">
                        Needs reply
                      </span>
                    ) : (
                      <span className="text-brand-black/45">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManageSupport ? (
                      <EsNaturalSupportButton clientId={c.id} clientLabel={c.displayName} />
                    ) : (
                      <span className="text-brand-black/45">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </ResponsiveTableShell>
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
