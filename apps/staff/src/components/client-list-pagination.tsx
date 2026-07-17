"use client";

import {
  CLIENT_LIST_PAGE_SIZE_KEY,
  clientListTotalPages,
  DEFAULT_CLIENT_LIST_PAGE_SIZE,
  parseClientListPageSize,
  readClientListPageSize,
  sliceClientListPage,
  writeClientListPageSize,
  type ClientListPageSize,
} from "@/lib/client-list-page-size";
import { useEffect, useState } from "react";

export function useClientListPagination<T>(items: T[]) {
  const [pageSize, setPageSizeState] = useState<ClientListPageSize>(DEFAULT_CLIENT_LIST_PAGE_SIZE);
  const [page, setPage] = useState(1);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPageSizeState(readClientListPageSize());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    function onStorage(event: StorageEvent) {
      if (event.key !== CLIENT_LIST_PAGE_SIZE_KEY) return;
      setPageSizeState(parseClientListPageSize(event.newValue));
      setPage(1);
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hydrated]);

  const totalPages = clientListTotalPages(items.length, pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageItems = sliceClientListPage(items, safePage, pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  function setPageSize(next: ClientListPageSize) {
    setPageSizeState(next);
    writeClientListPageSize(next);
    setPage(1);
  }

  return {
    pageSize,
    setPageSize,
    page: safePage,
    setPage,
    totalPages,
    pageItems,
    totalCount: items.length,
  };
}

type ControlsProps = {
  pageSize: ClientListPageSize;
  onPageSizeChange: (size: ClientListPageSize) => void;
  page: number;
  totalPages: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  className?: string;
};

export function ClientListPaginationControls({
  pageSize,
  onPageSizeChange,
  page,
  totalPages,
  totalCount,
  onPageChange,
  className = "",
}: ControlsProps) {
  if (totalCount === 0) return null;

  const showingAll = pageSize === "all";
  const start = showingAll ? 1 : (page - 1) * pageSize + 1;
  const end = showingAll ? totalCount : Math.min(page * pageSize, totalCount);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 text-sm text-brand-black/75 ${className}`}
    >
      <p>
        Showing {start}–{end} of {totalCount}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex items-center gap-2">
          <span className="whitespace-nowrap">Per page</span>
          <select
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(parseClientListPageSize(e.target.value))}
            className="rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-sm text-brand-black"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="all">All</option>
          </select>
        </label>
        {!showingAll && totalPages > 1 ? (
          <div className="inline-flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="rounded-lg border border-neutral-300 px-2.5 py-1.5 font-medium text-brand-black hover:bg-neutral-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
