import type { SupabaseClient } from "@supabase/supabase-js";

/** Columns that exist on Wayfinder contact_logs (outcome is legacy-only). */
const CONTACT_LOG_SELECT_SHAPES = [
  "id, client_id, created_at, public_outcome, notes",
  "id, client_id, created_at, public_outcome",
  "id, client_id, created_at, notes",
  "id, client_id, created_at, public_outcome, notes, outcome",
  "id, client_id, created_at, outcome",
] as const;

export type ContactLogContentFields = {
  public_outcome?: string | null;
  notes?: string | null;
  outcome?: string | null;
};

/** Counselor-visible / VPR copy text from a contact log row. */
export function contactLogDisplayText(row: ContactLogContentFields): string {
  return (row.public_outcome ?? row.notes ?? row.outcome ?? "").trim();
}

function isMissingColumnError(message: string): boolean {
  return /does not exist|Could not find the '|schema cache/i.test(message);
}

/**
 * Run a contact_logs select with progressive column fallbacks.
 * Prefer public_outcome/notes; only try legacy `outcome` after those fail.
 */
export async function fetchContactLogsWithSchemaFallback<T extends Record<string, unknown>>(
  run: (
    selectCols: string
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  let lastError: string | null = null;
  for (const cols of CONTACT_LOG_SELECT_SHAPES) {
    const { data, error } = await run(cols);
    if (!error) {
      return (data ?? []) as T[];
    }
    lastError = error.message;
    if (isMissingColumnError(error.message)) {
      continue;
    }
    throw new Error(error.message);
  }
  throw new Error(lastError ?? "Could not load contact logs");
}

/** Convenience: load contact logs for one or more client_id FK aliases. */
export async function listContactLogsForClientIds(
  admin: SupabaseClient,
  clientIds: string[],
  opts?: { orderAscending?: boolean; limit?: number }
): Promise<
  Array<{
    id: string;
    client_id: string;
    created_at: string;
    public_outcome: string | null;
    notes: string | null;
    outcome: string | null;
  }>
> {
  if (clientIds.length === 0) {
    return [];
  }
  const ascending = opts?.orderAscending ?? true;
  const limit = opts?.limit ?? 500;

  const rows = await fetchContactLogsWithSchemaFallback(async (cols) => {
    const result = await admin
      .from("contact_logs")
      .select(cols)
      .in("client_id", clientIds)
      .order("created_at", { ascending })
      .limit(limit);
    return {
      data: (result.data as Record<string, unknown>[] | null) ?? null,
      error: result.error,
    };
  });

  return rows.map((row) => ({
    id: row.id as string,
    client_id: row.client_id as string,
    created_at: row.created_at as string,
    public_outcome: (row.public_outcome as string | null | undefined) ?? null,
    notes: (row.notes as string | null | undefined) ?? null,
    outcome: (row.outcome as string | null | undefined) ?? null,
  }));
}
