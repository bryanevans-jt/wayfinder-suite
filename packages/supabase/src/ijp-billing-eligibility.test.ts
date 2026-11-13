import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientHasBillableTimeFromEntries,
  clientOnGaIjpDuringMonthFromRows,
  episodeCoversServiceDate,
  filterClientIdsOnGaIjpDuringMonth,
  filterClientIdsWithBillableTime,
  filterIjpAttributedBillableEntries,
  sumBillableHoursFromEntries,
  timeEntryAttributedToIjpService,
  unionClientIdLists,
} from "./ijp-billing-eligibility";

const GA_IJP = "svc-ga-ijp";
const OTHER = "svc-other";

const billableEntry = (
  minutes: number,
  extra: {
    service_date?: string;
    service_episode_id?: string | null;
  } = {}
) => ({
  duration_minutes: minutes,
  service_date: extra.service_date ?? "2026-10-10",
  service_episode_id: extra.service_episode_id ?? null,
  service_activity_types: {
    code: "JT-ACT-001",
    counts_toward_client_billable: true,
  },
});

const nonBillableEntry = (minutes: number) => ({
  duration_minutes: minutes,
  service_date: "2026-10-10",
  service_episode_id: null as string | null,
  service_activity_types: {
    code: "JT-ACT-099",
    counts_toward_client_billable: false,
  },
});

describe("IJP eligibility pure helpers", () => {
  it("detects episode overlap for GA IJP", () => {
    assert.equal(
      clientOnGaIjpDuringMonthFromRows(
        [{ service_id: GA_IJP, started_at: "2026-09-20", ended_at: null }],
        { current_service_id: "other", archived_at: null, is_demo: false },
        { name: "Other", state: "GA" },
        "2026-10-01",
        GA_IJP
      ),
      true
    );
  });

  it("detects current_service_id match and ignores archived-before-month", () => {
    assert.equal(
      clientOnGaIjpDuringMonthFromRows(
        [],
        { current_service_id: GA_IJP, archived_at: null, is_demo: false },
        null,
        "2026-10-01",
        GA_IJP
      ),
      true
    );
    assert.equal(
      clientOnGaIjpDuringMonthFromRows(
        [],
        { current_service_id: GA_IJP, archived_at: "2026-09-15", is_demo: false },
        null,
        "2026-10-01",
        GA_IJP
      ),
      false
    );
  });

  it("treats bare and (GA) IJP service ids as the same service", () => {
    const bareIjp = "svc-bare-ijp";
    assert.equal(
      clientOnGaIjpDuringMonthFromRows(
        [{ service_id: bareIjp, started_at: "2026-09-20", ended_at: null }],
        { current_service_id: bareIjp, archived_at: null, is_demo: false },
        { name: "Individual Job Placement", state: "GA" },
        "2026-10-01",
        [GA_IJP, bareIjp]
      ),
      true
    );
    assert.equal(
      clientOnGaIjpDuringMonthFromRows(
        [],
        { current_service_id: bareIjp, archived_at: null, is_demo: false },
        { name: "Individual Job Placement", state: "GA" },
        "2026-10-01",
        GA_IJP
      ),
      true
    );
  });

  it("detects billable minutes from activity embed", () => {
    assert.equal(clientHasBillableTimeFromEntries([billableEntry(45)]), true);
    assert.equal(clientHasBillableTimeFromEntries([nonBillableEntry(45)]), false);
  });

  it("filters batched eligibility snapshots by month", () => {
    const ids = filterClientIdsOnGaIjpDuringMonth(
      {
        a: {
          episodes: [{ service_id: GA_IJP, started_at: "2026-09-20", ended_at: null }],
          client: { current_service_id: "other", archived_at: null, is_demo: false },
          currentService: { name: "Other", state: "GA" },
        },
        b: {
          episodes: [],
          client: { current_service_id: "other", archived_at: null, is_demo: false },
          currentService: { name: "Other", state: "GA" },
        },
      },
      "2026-10-01",
      GA_IJP
    );
    assert.deepEqual(ids, ["a"]);
  });

  it("filters batched billable maps", () => {
    const ids = filterClientIdsWithBillableTime({
      a: [billableEntry(30)],
      b: [nonBillableEntry(30)],
    });
    assert.deepEqual(ids, ["a"]);
  });
});

describe("IJP time-entry service attribution", () => {
  const ijpEpisode = {
    id: "ep-ijp",
    service_id: GA_IJP,
    started_at: "2026-10-01",
    ended_at: "2026-10-15",
  };
  const otherEpisode = {
    id: "ep-other",
    service_id: OTHER,
    started_at: "2026-10-16",
    ended_at: null,
  };

  it("attributes via the entry's linked episode service_id (mid-period switch)", () => {
    assert.equal(
      timeEntryAttributedToIjpService({
        serviceDate: "2026-10-10",
        serviceEpisodeId: "ep-ijp",
        entryEpisode: ijpEpisode,
        clientEpisodes: [ijpEpisode, otherEpisode],
        ijpServiceIds: [GA_IJP],
      }),
      true
    );
    assert.equal(
      timeEntryAttributedToIjpService({
        serviceDate: "2026-10-20",
        serviceEpisodeId: "ep-other",
        entryEpisode: otherEpisode,
        clientEpisodes: [ijpEpisode, otherEpisode],
        ijpServiceIds: [GA_IJP],
      }),
      false
    );
  });

  it("falls back to IJP episode covering service_date when entry has no episode", () => {
    assert.equal(
      episodeCoversServiceDate(ijpEpisode, "2026-10-10"),
      true
    );
    assert.equal(
      timeEntryAttributedToIjpService({
        serviceDate: "2026-10-10",
        serviceEpisodeId: null,
        clientEpisodes: [ijpEpisode, otherEpisode],
        ijpServiceIds: [GA_IJP],
      }),
      true
    );
    assert.equal(
      timeEntryAttributedToIjpService({
        serviceDate: "2026-10-20",
        serviceEpisodeId: null,
        clientEpisodes: [ijpEpisode, otherEpisode],
        ijpServiceIds: [GA_IJP],
      }),
      false
    );
  });

  it("excludes non-IJP hours from IJP-attributed billable filter", () => {
    const episodes = [ijpEpisode, otherEpisode];
    const filtered = filterIjpAttributedBillableEntries(
      [
        billableEntry(60, { service_date: "2026-10-10", service_episode_id: "ep-ijp" }),
        billableEntry(90, { service_date: "2026-10-20", service_episode_id: "ep-other" }),
        nonBillableEntry(30),
      ],
      { clientEpisodes: episodes, ijpServiceIds: [GA_IJP] }
    );
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].duration_minutes, 60);
  });

  it("includes archived IJP client hours (archive status not consulted)", () => {
    // Attribution is episode/date based — archived_at is irrelevant here.
    const filtered = filterIjpAttributedBillableEntries(
      [billableEntry(45, { service_date: "2026-10-05", service_episode_id: "ep-ijp" })],
      { clientEpisodes: [ijpEpisode], ijpServiceIds: [GA_IJP] }
    );
    assert.equal(filtered.length, 1);
  });

  it("treats clients with only other-service hours as having no IJP hours", () => {
    const filtered = filterIjpAttributedBillableEntries(
      [billableEntry(120, { service_date: "2026-10-20", service_episode_id: "ep-other" })],
      { clientEpisodes: [ijpEpisode, otherEpisode], ijpServiceIds: [GA_IJP] }
    );
    assert.deepEqual(filtered, []);
  });
});

describe("IJP hours eligibility (Generate Invoices targets)", () => {
  it("includes archived IJP clients with IJP-attributed hours", () => {
    const episodes = [
      { id: "ep-ijp", service_id: GA_IJP, started_at: "2026-10-01", ended_at: null },
    ];
    const ijpHours = filterIjpAttributedBillableEntries(
      [billableEntry(60, { service_episode_id: "ep-ijp" })],
      { clientEpisodes: episodes, ijpServiceIds: [GA_IJP] }
    );
    assert.equal(ijpHours.length, 1);
    // Episode-only archived-before-month would fail month overlap, but hours path still bills.
    const episodeOnly = filterClientIdsOnGaIjpDuringMonth(
      {
        "archived-client": {
          episodes: [],
          client: {
            current_service_id: GA_IJP,
            archived_at: "2026-09-01",
            is_demo: false,
            intake_status: "closed",
          },
          currentService: null,
        },
      },
      "2026-10-01",
      GA_IJP
    );
    assert.deepEqual(episodeOnly, []);
  });

  it("includes ES and TS hours the same (no assignee-role filter)", () => {
    const episodes = [
      { id: "ep-ijp", service_id: GA_IJP, started_at: "2026-10-01", ended_at: null },
    ];
    const filtered = filterIjpAttributedBillableEntries(
      [
        billableEntry(15, { service_episode_id: "ep-ijp" }),
        billableEntry(45, { service_episode_id: "ep-ijp" }),
      ],
      { clientEpisodes: episodes, ijpServiceIds: [GA_IJP] }
    );
    assert.equal(filtered.length, 2);
  });

  it("excludes clients with no IJP billable hours from generate targets", () => {
    const episodes = [
      { id: "ep-ijp", service_id: GA_IJP, started_at: "2026-10-01", ended_at: null },
      { id: "ep-other", service_id: OTHER, started_at: "2026-10-01", ended_at: null },
    ];
    const onlyOther = filterIjpAttributedBillableEntries(
      [billableEntry(20, { service_episode_id: "ep-other" })],
      { clientEpisodes: episodes, ijpServiceIds: [GA_IJP] }
    );
    const noHours = filterIjpAttributedBillableEntries([nonBillableEntry(120)], {
      clientEpisodes: episodes,
      ijpServiceIds: [GA_IJP],
    });
    assert.deepEqual(onlyOther, []);
    assert.deepEqual(noHours, []);
  });
});

describe("IJP full-month hours totals", () => {
  it("sums all billable entry minutes for the month (full hours)", () => {
    const hours = sumBillableHoursFromEntries([
      billableEntry(30),
      billableEntry(90),
      nonBillableEntry(60),
      billableEntry(15),
    ]);
    assert.equal(hours, (30 + 90 + 15) / 60);
  });

  it("is idempotent for the same entry set", () => {
    const rows = [billableEntry(60), billableEntry(120)];
    assert.equal(sumBillableHoursFromEntries(rows), sumBillableHoursFromEntries(rows));
    assert.equal(sumBillableHoursFromEntries(rows), 3);
  });

  it("IJP totals exclude non-IJP hours after mid-period switch", () => {
    const episodes = [
      { id: "ep-ijp", service_id: GA_IJP, started_at: "2026-10-01", ended_at: "2026-10-15" },
      { id: "ep-other", service_id: OTHER, started_at: "2026-10-16", ended_at: null },
    ];
    const ijpOnly = filterIjpAttributedBillableEntries(
      [
        billableEntry(60, { service_date: "2026-10-10", service_episode_id: "ep-ijp" }),
        billableEntry(120, { service_date: "2026-10-20", service_episode_id: "ep-other" }),
      ],
      { clientEpisodes: episodes, ijpServiceIds: [GA_IJP] }
    );
    assert.equal(sumBillableHoursFromEntries(ijpOnly), 1);
  });
});

describe("IJP eligibility union idempotency", () => {
  it("unionClientIdLists is sorted, unique, and stable across re-runs", () => {
    const a = ["c", "a", "b"];
    const b = ["b", "d", "a"];
    const once = unionClientIdLists(a, b);
    const twice = unionClientIdLists(once, a, b);
    assert.deepEqual(once, ["a", "b", "c", "d"]);
    assert.deepEqual(twice, once);
  });
});
