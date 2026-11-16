import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributeFormalReportToService,
  formalReportAttributionDateYmd,
  paginateFormalReportRows,
} from "./formal-report-history";

const IJP = "svc-ijp";
const TSE = "svc-tse";

const servicesById = new Map([
  [IJP, { id: IJP, name: "Individual Job Placement (GA)", state: "GA" }],
  [TSE, { id: TSE, name: "Supported Employment (GA)", state: "GA" }],
]);

describe("formalReportAttributionDateYmd", () => {
  it("uses mid-month for YYYY-MM reporting months", () => {
    assert.equal(formalReportAttributionDateYmd("2026-10", "2026-11-01T00:00:00Z"), "2026-10-15");
  });

  it("falls back to created_at day when reporting month is missing", () => {
    assert.equal(formalReportAttributionDateYmd(null, "2026-09-03T12:00:00Z"), "2026-09-03");
  });
});

describe("attributeFormalReportToService", () => {
  const tseEpisode = {
    id: "ep-tse",
    service_id: TSE,
    started_at: "2026-01-01",
    ended_at: "2026-09-30",
  };
  const ijpEpisode = {
    id: "ep-ijp",
    service_id: IJP,
    started_at: "2026-10-01",
    ended_at: null,
  };

  it("labels prior-service reports and displays Individual Job Placement", () => {
    const prior = attributeFormalReportToService({
      reportingMonth: "2026-08",
      createdAt: "2026-09-01T00:00:00Z",
      clientEpisodes: [tseEpisode, ijpEpisode],
      currentServiceId: IJP,
      servicesById,
    });
    assert.equal(prior.serviceId, TSE);
    assert.equal(prior.isPriorService, true);
    assert.match(prior.serviceName ?? "", /Supported Employment/);

    const current = attributeFormalReportToService({
      reportingMonth: "2026-10",
      createdAt: "2026-11-01T00:00:00Z",
      clientEpisodes: [tseEpisode, ijpEpisode],
      currentServiceId: IJP,
      servicesById,
    });
    assert.equal(current.serviceId, IJP);
    assert.equal(current.isPriorService, false);
    assert.equal(current.serviceName, "Individual Job Placement");
  });

  it("returns no service when no episode covers the reporting month", () => {
    const result = attributeFormalReportToService({
      reportingMonth: "2025-01",
      createdAt: "2025-02-01T00:00:00Z",
      clientEpisodes: [tseEpisode, ijpEpisode],
      currentServiceId: IJP,
      servicesById,
    });
    assert.deepEqual(result, {
      serviceId: null,
      serviceName: null,
      isPriorService: false,
    });
  });
});

describe("paginateFormalReportRows", () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: String(i + 1) }));

  it("defaults to 10 per page and navigates", () => {
    const first = paginateFormalReportRows(rows, { page: 1, pageSize: 10 });
    assert.equal(first.pageCount, 3);
    assert.equal(first.pageRows.length, 10);
    assert.equal(first.pageRows[0]?.id, "1");

    const last = paginateFormalReportRows(rows, { page: 3, pageSize: 10 });
    assert.equal(last.pageRows.length, 3);
    assert.equal(last.page, 3);
  });

  it("supports 25 and All", () => {
    assert.equal(
      paginateFormalReportRows(rows, { page: 1, pageSize: 25 }).pageRows.length,
      23
    );
    assert.equal(
      paginateFormalReportRows(rows, { page: 1, pageSize: "all" }).pageRows.length,
      23
    );
  });
});
