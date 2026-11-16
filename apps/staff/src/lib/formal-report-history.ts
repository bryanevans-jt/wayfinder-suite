/**
 * Attribute formal report submissions to the client's service episode that
 * covered the reporting month (or submission date when month is missing).
 */

import { displayServiceCatalogName, serviceDisplayName } from "@wayfinder/branding";

export type FormalReportEpisode = {
  id?: string | null;
  service_id: string | null;
  started_at: string | null;
  ended_at: string | null;
};

export type FormalReportServiceRow = {
  id: string;
  name: string;
  state?: string | null;
};

/** YYYY-MM or YYYY-MM-DD → a calendar day used to pick the covering episode. */
export function formalReportAttributionDateYmd(
  reportingMonth: string | null | undefined,
  createdAt: string | null | undefined
): string | null {
  const month = (reportingMonth ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(month)) return `${month}-15`;
  if (/^\d{4}-\d{2}-\d{2}/.test(month)) return month.slice(0, 10);

  const created = (createdAt ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(created)) return created.slice(0, 10);
  return null;
}

export function episodeCoversYmd(
  episode: Pick<FormalReportEpisode, "started_at" | "ended_at">,
  ymd: string
): boolean {
  const start = (episode.started_at ?? "").slice(0, 10);
  if (!start || !ymd) return false;
  const end = episode.ended_at ? episode.ended_at.slice(0, 10) : "9999-12-31";
  return start <= ymd && end >= ymd;
}

/** Prefer the latest-started episode covering the attribution date. */
export function findEpisodeCoveringYmd(
  episodes: readonly FormalReportEpisode[],
  ymd: string | null
): FormalReportEpisode | null {
  if (!ymd) return null;
  const covering = episodes.filter((ep) => episodeCoversYmd(ep, ymd));
  if (covering.length === 0) return null;
  covering.sort((a, b) => {
    const as = (a.started_at ?? "").slice(0, 10);
    const bs = (b.started_at ?? "").slice(0, 10);
    return (
      bs.localeCompare(as) ||
      String(b.id ?? "").localeCompare(String(a.id ?? ""))
    );
  });
  return covering[0] ?? null;
}

export type FormalReportServiceAttribution = {
  serviceId: string | null;
  serviceName: string | null;
  isPriorService: boolean;
};

export function attributeFormalReportToService(opts: {
  reportingMonth: string | null | undefined;
  createdAt: string | null | undefined;
  clientEpisodes: readonly FormalReportEpisode[];
  currentServiceId: string | null | undefined;
  servicesById: ReadonlyMap<string, FormalReportServiceRow>;
}): FormalReportServiceAttribution {
  const ymd = formalReportAttributionDateYmd(opts.reportingMonth, opts.createdAt);
  const episode = findEpisodeCoveringYmd(opts.clientEpisodes, ymd);
  const serviceId = (episode?.service_id as string | null) ?? null;
  if (!serviceId) {
    return { serviceId: null, serviceName: null, isPriorService: false };
  }

  const service = opts.servicesById.get(serviceId) ?? null;
  const serviceName = service
    ? serviceDisplayName(service)
    : displayServiceCatalogName(serviceId) || null;

  const current = (opts.currentServiceId ?? "").trim();
  const isPriorService = Boolean(current && serviceId !== current);

  return { serviceId, serviceName, isPriorService };
}

export type FormalReportPageSize = 10 | 25 | "all";

export function normalizeFormalReportPageSize(
  value: unknown
): FormalReportPageSize {
  if (value === "all" || value === "All") return "all";
  const n = typeof value === "number" ? value : Number(value);
  if (n === 25) return 25;
  return 10;
}

/** Client-side page slice (newest-first list already ordered). */
export function paginateFormalReportRows<T>(
  rows: readonly T[],
  opts: { page: number; pageSize: FormalReportPageSize }
): { pageRows: T[]; page: number; pageCount: number; total: number } {
  const total = rows.length;
  if (opts.pageSize === "all" || total === 0) {
    return { pageRows: [...rows], page: 1, pageCount: 1, total };
  }
  const pageCount = Math.max(1, Math.ceil(total / opts.pageSize));
  const page = Math.min(Math.max(1, Math.floor(opts.page) || 1), pageCount);
  const start = (page - 1) * opts.pageSize;
  return {
    pageRows: rows.slice(start, start + opts.pageSize) as T[],
    page,
    pageCount,
    total,
  };
}
