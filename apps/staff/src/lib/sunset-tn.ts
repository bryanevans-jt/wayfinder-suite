import type { SupabaseClient } from "@supabase/supabase-js";

/** Wayfinder is no longer opening Tennessee work; keep rows in the DB. */
export const SUNSET_STATE = "TN";

export type SunsetKeepIds = {
  tnOfficeIds: Set<string>;
  keepOfficeIds: Set<string>;
  keepCounselorIds: Set<string>;
  keepServiceIds: Set<string>;
};

export function isSunsetState(state: string | null | undefined): boolean {
  return (state ?? "").trim().toUpperCase() === SUNSET_STATE;
}

export function isSunsetOffice(office: {
  state?: string | null;
  name?: string | null;
}): boolean {
  if (isSunsetState(office.state)) return true;
  return /\(\s*TN\s*\)\s*$/i.test((office.name ?? "").trim());
}

export function isSunsetService(service: {
  state?: string | null;
  name?: string | null;
}): boolean {
  if (isSunsetState(service.state)) return true;
  return /\(\s*TN\s*\)\s*$/i.test((service.name ?? "").trim());
}

function stillReceivingServices(archivedAt: string | null | undefined): boolean {
  return archivedAt == null || archivedAt.length === 0;
}

function pinSet(ids?: Iterable<string | null | undefined>): Set<string> {
  const set = new Set<string>();
  for (const id of ids ?? []) {
    if (id) set.add(id);
  }
  return set;
}

export function filterSunsetOffices<T extends { id: string; state?: string | null; name?: string | null }>(
  offices: T[],
  keepOfficeIds: Set<string>,
  alwaysIncludeIds?: Iterable<string | null | undefined>
): T[] {
  const pinned = pinSet(alwaysIncludeIds);
  return offices.filter((office) => {
    if (!isSunsetOffice(office)) return true;
    return keepOfficeIds.has(office.id) || pinned.has(office.id);
  });
}

export function filterSunsetServices<T extends { id: string; state?: string | null; name?: string | null }>(
  services: T[],
  keepServiceIds: Set<string>,
  alwaysIncludeIds?: Iterable<string | null | undefined>
): T[] {
  const pinned = pinSet(alwaysIncludeIds);
  return services.filter((service) => {
    if (!isSunsetService(service)) return true;
    return keepServiceIds.has(service.id) || pinned.has(service.id);
  });
}

export function filterSunsetCounselors<
  T extends { id: string; office_id?: string | null; office_ids?: string[] },
>(
  counselors: T[],
  options: {
    tnOfficeIds: Set<string>;
    keepOfficeIds: Set<string>;
    keepCounselorIds: Set<string>;
    alwaysIncludeIds?: Iterable<string | null | undefined>;
  }
): T[] {
  const pinned = pinSet(options.alwaysIncludeIds);
  return counselors.filter((counselor) => {
    if (pinned.has(counselor.id) || options.keepCounselorIds.has(counselor.id)) {
      return true;
    }
    const officeIds = [
      ...(counselor.office_ids ?? []),
      counselor.office_id ?? "",
    ].filter(Boolean);
    const tnOffices = officeIds.filter((id) => options.tnOfficeIds.has(id));
    if (tnOffices.length === 0) {
      return true;
    }
    const hasVisibleTnOffice = tnOffices.some((id) => options.keepOfficeIds.has(id));
    const hasNonTnOffice = officeIds.some((id) => !options.tnOfficeIds.has(id));
    return hasVisibleTnOffice || hasNonTnOffice;
  });
}

export function sunsetKeepIdsFromLoadedData(input: {
  offices: Array<{ id: string; state?: string | null; name?: string | null }>;
  clients: Array<{
    office_id?: string | null;
    counselor_id?: string | null;
    current_service_id?: string | null;
    archived_at?: string | null;
  }>;
  counselors?: Array<{ id: string; office_id?: string | null }>;
  counselorOfficeLinks?: Array<{ counselor_id?: string | null; office_id?: string | null }>;
}): SunsetKeepIds {
  const tnOfficeIds = new Set(
    input.offices.filter((office) => isSunsetOffice(office)).map((office) => office.id)
  );
  const keepOfficeIds = new Set<string>();
  const keepCounselorIds = new Set<string>();
  const keepServiceIds = new Set<string>();

  for (const row of input.clients) {
    if (!stillReceivingServices(row.archived_at)) continue;
    const officeId = row.office_id ?? null;
    if (officeId && tnOfficeIds.has(officeId)) {
      keepOfficeIds.add(officeId);
    }
    const counselorId = row.counselor_id ?? null;
    if (counselorId && officeId && tnOfficeIds.has(officeId)) {
      keepCounselorIds.add(counselorId);
    }
    const serviceId = row.current_service_id ?? null;
    if (serviceId && officeId && tnOfficeIds.has(officeId)) {
      keepServiceIds.add(serviceId);
    }
  }

  for (const counselor of input.counselors ?? []) {
    if (counselor.office_id && keepOfficeIds.has(counselor.office_id)) {
      keepCounselorIds.add(counselor.id);
    }
  }
  for (const link of input.counselorOfficeLinks ?? []) {
    if (link.counselor_id && link.office_id && keepOfficeIds.has(link.office_id)) {
      keepCounselorIds.add(link.counselor_id);
    }
  }

  return { tnOfficeIds, keepOfficeIds, keepCounselorIds, keepServiceIds };
}

export async function loadSunsetKeepIds(admin: SupabaseClient): Promise<SunsetKeepIds> {
  const empty: SunsetKeepIds = {
    tnOfficeIds: new Set(),
    keepOfficeIds: new Set(),
    keepCounselorIds: new Set(),
    keepServiceIds: new Set(),
  };

  const { data: offices, error: officeErr } = await admin
    .from("offices")
    .select("id, state, name");
  if (officeErr) {
    return empty;
  }

  let clientQuery = await admin
    .from("clients")
    .select("office_id, counselor_id, current_service_id, archived_at");
  if (clientQuery.error?.message.includes("archived_at")) {
    clientQuery = await admin.from("clients").select("office_id, counselor_id, current_service_id");
  }
  if (clientQuery.error) {
    return empty;
  }

  const { data: counselors } = await admin.from("counselors").select("id, office_id");
  const { data: counselorOfficeLinks } = await admin
    .from("counselor_office_assignments")
    .select("counselor_id, office_id");

  return sunsetKeepIdsFromLoadedData({
    offices: (offices ?? []).map((o) => ({
      id: o.id as string,
      state: o.state as string | null,
      name: o.name as string | null,
    })),
    clients: (clientQuery.data ?? []) as Array<{
      office_id?: string | null;
      counselor_id?: string | null;
      current_service_id?: string | null;
      archived_at?: string | null;
    }>,
    counselors: (counselors ?? []).map((c) => ({
      id: c.id as string,
      office_id: (c.office_id as string | null) ?? null,
    })),
    counselorOfficeLinks: (counselorOfficeLinks ?? []).map((l) => ({
      counselor_id: (l.counselor_id as string | null) ?? null,
      office_id: (l.office_id as string | null) ?? null,
    })),
  });
}
