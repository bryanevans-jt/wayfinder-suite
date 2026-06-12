import type { SupabaseClient } from "@supabase/supabase-js";

function isRetryableOfficeInsertError(message: string): boolean {
  return (
    /null value in column/i.test(message) ||
    /Could not find the '([^']+)' column/.test(message) ||
    /invalid input value for enum/i.test(message)
  );
}

function uniqueRows(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const key = JSON.stringify(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

/** Inserts an office row across Wayfinder (name only) and legacy (state/city NOT NULL) schemas. */
export async function insertOfficeRow(
  admin: SupabaseClient,
  name: string,
  opts?: { state?: string; city?: string }
): Promise<{ id: string; name: string; city: string | null; state: string | null }> {
  const trimmedName = name.trim();
  const { data: template } = await admin.from("offices").select("state, city").limit(1).maybeSingle();

  const templateState = (template?.state as string | undefined)?.trim();
  const templateCity = (template?.city as string | undefined)?.trim();
  const stateHint = (opts?.state ?? templateState ?? "GA").trim();
  const cityHint = (opts?.city ?? templateCity ?? trimmedName).trim();

  const attempts = uniqueRows([
    { name: trimmedName, state: stateHint, city: cityHint },
    { name: trimmedName, state: stateHint },
    { name: trimmedName },
    { name: trimmedName, state: "GA" },
    { name: trimmedName, state: "TN" },
    { name: trimmedName, state: "GA", city: cityHint },
    { name: trimmedName, state: "TN", city: cityHint },
  ]);

  let lastMessage = "Could not create office";

  for (const row of attempts) {
    const { data, error } = await admin
      .from("offices")
      .insert(row)
      .select("id, name, city, state")
      .single();
    if (!error && data?.id) {
      return {
        id: data.id as string,
        name: data.name as string,
        city: (data.city as string | null) ?? null,
        state: (data.state as string | null) ?? null,
      };
    }
    lastMessage = error?.message ?? lastMessage;
    if (!error || !isRetryableOfficeInsertError(error.message)) {
      break;
    }
  }

  throw new Error(lastMessage);
}
