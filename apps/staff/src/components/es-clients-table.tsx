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
import { restoreArchivedClient } from "@/app/dashboard/clients/[id]/actions";
import type { CaseloadTriageFlag } from "@wayfinder/supabase/caseload-triage";
import { friendlyClientError } from "@wayfinder/supabase/error-log";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export type EsClientListRow = {
  id: string;
  displayName: string;
  serviceLabel: string;
  stageLabel: string;
  overdue: boolean;
  archived: boolean;
  pendingArchive: boolean;
  triageFlags: CaseloadTriageFlag[];
};

type Props = {
  clients: EsClientListRow[];
  includeArchived: boolean;
  canManageSupport: boolean;
};

export function EsClientsTable({ clients, includeArchived, canManageSupport }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { pageSize, setPageSize, page, setPage, totalPages, pageItems, totalCount } =
    useClientListPagination(clients);

  function restore(clientId: string, name: string) {
    if (
      !confirm(
        `Restore ${name} to an active stage? They will return to your active caseload.`
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await restoreArchivedClient(clientId);
        router.refresh();
      } catch (e) {
        setError(friendlyClientError(e));
      }
    });
  }

  return (
    <div className="mt-8 space-y-3">
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
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
              {includeArchived ? (
                <th className="px-4 py-3 font-semibold text-brand-black">Actions</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td
                  colSpan={includeArchived ? 6 : 5}
                  className="px-4 py-8 text-center text-brand-black/70"
                >
                  {includeArchived
                    ? "No closed or archived clients assigned to you."
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
                    ) : c.pendingArchive ? (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase text-amber-900">
                        Closing
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
                  {includeArchived ? (
                    <td className="px-4 py-3">
                      {c.archived || c.pendingArchive ? (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => restore(c.id, c.displayName)}
                          className="text-sm font-semibold text-brand-green hover:underline disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <span className="text-brand-black/45">—</span>
                      )}
                    </td>
                  ) : null}
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
