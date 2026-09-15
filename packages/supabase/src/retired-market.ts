import type { SupabaseClient } from "@supabase/supabase-js";

/** Retired market code in DB (not shown in product UI). */
export const RETIRED_MARKET_STATE = "TN";

export type RetiredMarketContext = {
  retiredOfficeIds: Set<string>;
};

export function isRetiredMarketState(state: string | null | undefined): boolean {
  return (state ?? "").trim().toUpperCase() === RETIRED_MARKET_STATE;
}

export function isRetiredMarketOffice(office: {
  state?: string | null;
  name?: string | null;
}): boolean {
  if (isRetiredMarketState(office.state)) return true;
  return /\(\s*TN\s*\)\s*$/i.test((office.name ?? "").trim());
}

export function isRetiredMarketService(service: {
  state?: string | null;
  name?: string | null;
}): boolean {
  if (isRetiredMarketState(service.state)) return true;
  return /\(\s*TN\s*\)\s*$/i.test((service.name ?? "").trim());
}

export function retiredMarketContextFromOffices(
  offices: Array<{ id: string; state?: string | null; name?: string | null }>
): RetiredMarketContext {
  const retiredOfficeIds = new Set(
    offices.filter((office) => isRetiredMarketOffice(office)).map((office) => office.id)
  );
  return { retiredOfficeIds };
}

export function filterRetiredMarketOffices<
  T extends { id: string; state?: string | null; name?: string | null },
>(offices: T[]): T[] {
  return offices.filter((office) => !isRetiredMarketOffice(office));
}

export function filterRetiredMarketServices<
  T extends { id: string; state?: string | null; name?: string | null },
>(services: T[]): T[] {
  return services.filter((service) => !isRetiredMarketService(service));
}

export function isRetiredMarketCounselor(
  counselor: { id: string; office_id?: string | null; office_ids?: string[] },
  ctx: RetiredMarketContext
): boolean {
  const officeIds = [
    ...(counselor.office_ids ?? []),
    counselor.office_id ?? "",
  ].filter(Boolean);
  if (officeIds.length === 0) {
    return false;
  }
  return officeIds.every((id) => ctx.retiredOfficeIds.has(id));
}

export function filterRetiredMarketCounselors<
  T extends { id: string; office_id?: string | null; office_ids?: string[] },
>(counselors: T[], ctx: RetiredMarketContext): T[] {
  return counselors.filter((counselor) => !isRetiredMarketCounselor(counselor, ctx));
}

export function isRetiredMarketClient(
  client: {
    office_id?: string | null;
    referral_state?: string | null;
    current_service_id?: string | null;
  },
  ctx: RetiredMarketContext,
  servicesById?: Map<string, { state?: string | null; name?: string | null }>
): boolean {
  if (isRetiredMarketState(client.referral_state)) {
    return true;
  }
  const officeId = client.office_id ?? null;
  if (officeId && ctx.retiredOfficeIds.has(officeId)) {
    return true;
  }
  const serviceId = client.current_service_id ?? null;
  if (serviceId && servicesById) {
    const service = servicesById.get(serviceId);
    if (service && isRetiredMarketService(service)) {
      return true;
    }
  }
  return false;
}

export function filterRetiredMarketClients<
  T extends {
    office_id?: string | null;
    referral_state?: string | null;
    current_service_id?: string | null;
  },
>(
  clients: T[],
  ctx: RetiredMarketContext,
  servicesById?: Map<string, { state?: string | null; name?: string | null }>
): T[] {
  return clients.filter((client) => !isRetiredMarketClient(client, ctx, servicesById));
}

/** @deprecated Use {@link retiredMarketContextFromOffices} — keep sets are no longer used in UI. */
export type SunsetKeepIds = {
  tnOfficeIds: Set<string>;
  keepOfficeIds: Set<string>;
  keepCounselorIds: Set<string>;
  keepServiceIds: Set<string>;
};

/** @deprecated Retired-market rows stay in DB; app filters exclude them entirely. */
export async function loadSunsetKeepIds(admin: SupabaseClient): Promise<SunsetKeepIds> {
  const { data: offices, error: officeErr } = await admin
    .from("offices")
    .select("id, state, name");
  if (officeErr) {
    return {
      tnOfficeIds: new Set(),
      keepOfficeIds: new Set(),
      keepCounselorIds: new Set(),
      keepServiceIds: new Set(),
    };
  }

  const ctx = retiredMarketContextFromOffices(
    (offices ?? []).map((o) => ({
      id: o.id as string,
      state: o.state as string | null,
      name: o.name as string | null,
    }))
  );

  return {
    tnOfficeIds: ctx.retiredOfficeIds,
    keepOfficeIds: new Set(),
    keepCounselorIds: new Set(),
    keepServiceIds: new Set(),
  };
}
