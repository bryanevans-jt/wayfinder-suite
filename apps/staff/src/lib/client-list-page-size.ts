export type ClientListPageSize = 10 | 25 | "all";

export const CLIENT_LIST_PAGE_SIZE_KEY = "wayfinder-client-list-page-size";
export const DEFAULT_CLIENT_LIST_PAGE_SIZE: ClientListPageSize = 25;

export function parseClientListPageSize(raw: string | null | undefined): ClientListPageSize {
  if (raw === "10") return 10;
  if (raw === "all") return "all";
  return 25;
}

export function readClientListPageSize(): ClientListPageSize {
  if (typeof window === "undefined") return DEFAULT_CLIENT_LIST_PAGE_SIZE;
  try {
    return parseClientListPageSize(window.localStorage.getItem(CLIENT_LIST_PAGE_SIZE_KEY));
  } catch {
    return DEFAULT_CLIENT_LIST_PAGE_SIZE;
  }
}

export function writeClientListPageSize(size: ClientListPageSize): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLIENT_LIST_PAGE_SIZE_KEY, String(size));
  } catch {
    // Ignore quota / private mode failures.
  }
}

export function clientListTotalPages(itemCount: number, pageSize: ClientListPageSize): number {
  if (pageSize === "all" || itemCount === 0) return 1;
  return Math.max(1, Math.ceil(itemCount / pageSize));
}

export function sliceClientListPage<T>(
  items: T[],
  page: number,
  pageSize: ClientListPageSize
): T[] {
  if (pageSize === "all") return items;
  const totalPages = clientListTotalPages(items.length, pageSize);
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
