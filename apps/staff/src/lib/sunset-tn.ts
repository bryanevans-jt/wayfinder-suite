import type { SupabaseClient } from "@supabase/supabase-js";
import {
  filterRetiredMarketClients,
  filterRetiredMarketCounselors,
  filterRetiredMarketOffices,
  filterRetiredMarketServices,
  isRetiredMarketClient,
  isRetiredMarketOffice,
  isRetiredMarketService,
  isRetiredMarketState,
  loadSunsetKeepIds,
  retiredMarketContextFromOffices,
  RETIRED_MARKET_STATE,
  type RetiredMarketContext,
  type SunsetKeepIds,
} from "@wayfinder/supabase/retired-market";

export {
  loadSunsetKeepIds,
  type SunsetKeepIds,
  isRetiredMarketClient as isSunsetClient,
  isRetiredMarketOffice as isSunsetOffice,
  isRetiredMarketService as isSunsetService,
  isRetiredMarketState as isSunsetState,
  filterRetiredMarketClients as filterSunsetClients,
  retiredMarketContextFromOffices,
  type RetiredMarketContext,
};

/** @deprecated Internal DB code only — not shown in UI. */
export const SUNSET_STATE = RETIRED_MARKET_STATE;

export function filterSunsetOffices<
  T extends { id: string; state?: string | null; name?: string | null },
>(
  offices: T[],
  _keepOfficeIds?: Set<string>,
  _alwaysIncludeIds?: Iterable<string | null | undefined>
): T[] {
  void _keepOfficeIds;
  void _alwaysIncludeIds;
  return filterRetiredMarketOffices(offices);
}

export function filterSunsetServices<
  T extends { id: string; state?: string | null; name?: string | null },
>(
  services: T[],
  _keepServiceIds?: Set<string>,
  _alwaysIncludeIds?: Iterable<string | null | undefined>
): T[] {
  void _keepServiceIds;
  void _alwaysIncludeIds;
  return filterRetiredMarketServices(services);
}

export function filterSunsetCounselors<
  T extends { id: string; office_id?: string | null; office_ids?: string[] },
>(
  counselors: T[],
  options: {
    tnOfficeIds: Set<string>;
    keepOfficeIds?: Set<string>;
    keepCounselorIds?: Set<string>;
    alwaysIncludeIds?: Iterable<string | null | undefined>;
  }
): T[] {
  void options.keepOfficeIds;
  void options.keepCounselorIds;
  void options.alwaysIncludeIds;
  return filterRetiredMarketCounselors(counselors, {
    retiredOfficeIds: options.tnOfficeIds,
  });
}

/** @deprecated Keep sets are unused; returns empty keep* sets and retired office ids. */
export function sunsetKeepIdsFromLoadedData(input: {
  offices: Array<{ id: string; state?: string | null; name?: string | null }>;
  clients?: unknown[];
  counselors?: unknown[];
  counselorOfficeLinks?: unknown[];
}): SunsetKeepIds {
  void input.clients;
  void input.counselors;
  void input.counselorOfficeLinks;
  const ctx = retiredMarketContextFromOffices(input.offices);
  return {
    tnOfficeIds: ctx.retiredOfficeIds,
    keepOfficeIds: new Set(),
    keepCounselorIds: new Set(),
    keepServiceIds: new Set(),
  };
}

export async function reloadSunsetKeepIds(admin: SupabaseClient): Promise<SunsetKeepIds> {
  return loadSunsetKeepIds(admin);
}
