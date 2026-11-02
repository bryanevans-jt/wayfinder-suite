import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST default page size; unbounded selects silently truncate at this limit. */
export const POSTGREST_DEFAULT_PAGE_SIZE = 1000;

type OrderSpec = { column: string; ascending?: boolean };

type AnyFilterBuilder = PostgrestFilterBuilder<any, any, any, any[], string, unknown, "GET">;
type FetchAllOptions = {
  order?: OrderSpec | OrderSpec[];
  applyFilters?: (query: AnyFilterBuilder) => AnyFilterBuilder;
  pageSize?: number;
};

/**
 * Fetch every row from a table query by paging with `.range()`.
 * Use for admin lists that must not miss rows beyond the first 1000.
 */
export async function fetchAllPostgrestRows<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  select: string,
  options?: FetchAllOptions
): Promise<T[]> {
  const pageSize = options?.pageSize ?? POSTGREST_DEFAULT_PAGE_SIZE;
  const all: T[] = [];
  let from = 0;

  while (true) {
    let query = admin.from(table).select(select) as AnyFilterBuilder;

    if (options?.applyFilters) {
      query = options.applyFilters(query);
    }

    const orders = options?.order
      ? Array.isArray(options.order)
        ? options.order
        : [options.order]
      : [];
    for (const spec of orders) {
      query = query.order(spec.column, { ascending: spec.ascending ?? true });
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

/**
 * Fetch rows for a potentially large `.in(...)` filter without creating an
 * oversized PostgREST URL. Chunks run sequentially to keep database pressure bounded.
 */
export async function fetchAllPostgrestRowsByIn<
  T extends Record<string, unknown>,
>(
  admin: SupabaseClient,
  table: string,
  select: string,
  column: string,
  values: string[],
  options?: FetchAllOptions & { inChunkSize?: number }
): Promise<T[]> {
  const unique = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (unique.length === 0) return [];
  const chunkSize = Math.max(1, options?.inChunkSize ?? 100);
  const rows: T[] = [];

  for (let index = 0; index < unique.length; index += chunkSize) {
    const chunk = unique.slice(index, index + chunkSize);
    const chunkRows = await fetchAllPostgrestRows<T>(
      admin,
      table,
      select,
      {
        order: options?.order,
        pageSize: options?.pageSize,
        applyFilters: (query) => {
          const filtered = query.in(column, chunk);
          return options?.applyFilters
            ? options.applyFilters(filtered)
            : filtered;
        },
      }
    );
    rows.push(...chunkRows);
  }
  return rows;
}
