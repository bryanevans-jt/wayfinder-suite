"use client";

import {
  ClientListPaginationControls,
  useClientListPagination,
} from "@/components/client-list-pagination";
import {
  filterAccountsClientListRows,
  type AccountsClientListRow,
} from "@/lib/accounts-client-list";
import Link from "next/link";
import { useMemo, useState } from "react";

type Props = {
  rows: AccountsClientListRow[];
};

export function AccountsClientsReadonlyTable({ rows }: Props) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () => filterAccountsClientListRows(rows, query),
    [rows, query]
  );
  const { pageSize, setPageSize, page, setPage, totalPages, pageItems, totalCount } =
    useClientListPagination(filtered);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm text-brand-black/80">
          Search by name
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Client name…"
            className="mt-1 block w-72 max-w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <p className="pb-2 text-xs text-brand-black/55">
          {totalCount} client{totalCount === 1 ? "" : "s"}
          {query.trim() ? " matching search" : ""} · view-only
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-xs uppercase tracking-wide text-brand-black/55">
            <tr>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Current Service</th>
              <th className="px-3 py-2 font-medium">Current Stage</th>
              <th className="px-3 py-2 font-medium">Employment Specialist</th>
              <th className="px-3 py-2 font-medium">Supervisor</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((row) => (
              <tr key={row.clientId} className="border-b border-neutral-100">
                <td className="px-3 py-2">
                  <Link
                    href={`/dashboard/clients/${row.clientId}`}
                    className="font-medium text-brand-green underline-offset-2 hover:underline"
                  >
                    {row.clientName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-brand-black/85">
                  {row.serviceName ?? "—"}
                </td>
                <td className="px-3 py-2 text-brand-black/85">
                  {row.stageTitle ?? "—"}
                </td>
                <td className="px-3 py-2 text-brand-black/85">
                  {row.assignedEsName ?? "—"}
                </td>
                <td className="px-3 py-2 text-brand-black/85">
                  {row.supervisorName ?? "—"}
                </td>
              </tr>
            ))}
            {pageItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-8 text-center text-brand-black/55"
                >
                  {query.trim()
                    ? "No clients match that search."
                    : "No active clients found."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
