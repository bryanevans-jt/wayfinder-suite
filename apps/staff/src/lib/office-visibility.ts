import type { SupabaseClient } from "@supabase/supabase-js";
import { filterSunsetOffices, loadSunsetKeepIds } from "@/lib/sunset-tn";

export type OfficeRecord = {
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  is_hidden?: boolean | null;
};

export function isOfficeHidden(office: Pick<OfficeRecord, "is_hidden">): boolean {
  return office.is_hidden === true;
}

export function filterOfficesForPicker(
  offices: OfficeRecord[],
  options: {
    includeHidden?: boolean;
    alwaysIncludeIds?: Iterable<string | null | undefined>;
    sunsetKeepOfficeIds?: Set<string>;
  } = {}
): OfficeRecord[] {
  const pinned = new Set(
    [...(options.alwaysIncludeIds ?? [])].filter((id): id is string => Boolean(id))
  );
  const afterSunset =
    options.sunsetKeepOfficeIds === undefined
      ? offices
      : filterSunsetOffices(offices, options.sunsetKeepOfficeIds, pinned);
  if (options.includeHidden) {
    return afterSunset;
  }
  return afterSunset.filter((office) => !isOfficeHidden(office) || pinned.has(office.id));
}

export function collectReferencedOfficeIds(
  ...idLists: Array<Iterable<string | null | undefined>>
): Set<string> {
  const ids = new Set<string>();
  for (const list of idLists) {
    for (const id of list) {
      if (id) ids.add(id);
    }
  }
  return ids;
}

export async function queryAllOffices(admin: SupabaseClient): Promise<OfficeRecord[]> {
  let result = await admin
    .from("offices")
    .select("id, name, city, state, is_hidden")
    .order("name");

  if (
    result.error?.message.includes("is_hidden") ||
    result.error?.message.includes("city") ||
    result.error?.message.includes("state")
  ) {
    const fallback = await admin.from("offices").select("id, name").order("name");
    if (fallback.error) {
      throw new Error(fallback.error.message);
    }
    return ((fallback.data ?? []) as OfficeRecord[]).map((office) => ({
      ...office,
      city: office.city ?? null,
      state: office.state ?? null,
      is_hidden: false,
    }));
  }

  if (result.error) {
    throw new Error(result.error.message);
  }

  return (result.data ?? []) as OfficeRecord[];
}

export async function fetchOfficesForPicker(
  client: SupabaseClient,
  options: { includeHidden?: boolean; alwaysIncludeIds?: Iterable<string | null | undefined> } = {}
): Promise<Array<{ id: string; name: string; state?: string | null }>> {
  const [offices, sunset] = await Promise.all([queryAllOffices(client), loadSunsetKeepIds(client)]);
  return filterOfficesForPicker(offices, {
    ...options,
    sunsetKeepOfficeIds: sunset.keepOfficeIds,
  }).map((office) => ({
    id: office.id,
    name: office.name,
    state: office.state ?? null,
  }));
}
