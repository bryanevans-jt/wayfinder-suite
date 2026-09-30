import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST default page size; unbounded selects silently truncate at this limit. */
export const POSTGREST_DEFAULT_PAGE_SIZE = 1000;

type OrderSpec = { column: string; ascending?: boolean };

type AnyFilterBuilder = PostgrestFilterBuilder<any, any, any, any[], string, unknown, "GET">;

/**
 * Fetch every row from a table query by paging with `.range()`.
 * Use for admin lists that must not miss rows beyond the first 1000.
 */
export async function fetchAllPostgrestRows<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  select: string,
  options?: {
    order?: OrderSpec | OrderSpec[];
    applyFilters?: (query: AnyFilterBuilder) => AnyFilterBuilder;
    pageSize?: number;
  }
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
