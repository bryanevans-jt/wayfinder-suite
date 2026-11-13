import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientHasBillableTimeFromEntries,
  clientOnGaIjpDuringMonthFromRows,
  filterClientIdsOnGaIjpDuringMonth,
  filterClientIdsWithBillableTime,
  sumBillableHoursFromEntries,
  unionClientIdLists,
} from "./ijp-billing-eligibility";

const GA_IJP = "svc-ga-ijp";

const billableEntry = (minutes: number) => ({
  duration_minutes: minutes,
  service_activity_types: {
    code: "JT-ACT-001",
    counts_toward_client_billable: true,
  },
});

const nonBillableEntry = (minutes: number) => ({
  duration_minutes: minutes,
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

describe("IJP hours eligibility (Generate Month targets)", () => {
  it("includes archived / closed clients that still have billable hours", () => {
    // Hours path does not consult archive status — only billable entries matter.
    const hoursIds = filterClientIdsWithBillableTime({
      "archived-client": [billableEntry(60)],
      "active-client": [billableEntry(30)],
    });
    assert.ok(hoursIds.includes("archived-client"));
    assert.ok(hoursIds.includes("active-client"));

    // Episode logic alone would drop archived-before-month current-IJP clients,
    // but the union keeps them when they have hours.
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
    assert.deepEqual(
      unionClientIdLists(hoursIds.filter((id) => id === "archived-client"), episodeOnly),
      ["archived-client"]
    );
  });

  it("includes clients with hours from ES or TS (no assignee-role filter)", () => {
    // Billable detection is entry-based; ES vs TS / supervisor / unassigned is irrelevant.
    const ids = filterClientIdsWithBillableTime({
      "es-logged": [billableEntry(15)],
      "ts-logged": [billableEntry(45)],
      "unassigned-client": [billableEntry(90)],
    });
    assert.deepEqual(ids.sort(), ["es-logged", "ts-logged", "unassigned-client"]);
  });

  it("excludes clients with no billable hours from generate targets", () => {
    const ids = filterClientIdsWithBillableTime({
      "hours-client": [billableEntry(20)],
      "episode-only-no-hours": [nonBillableEntry(120)],
      "empty-client": [],
    });
    assert.deepEqual(ids, ["hours-client"]);
    // Episode-eligible without hours stays in the eligibility union but is not a generate target.
    const episodeIds = filterClientIdsOnGaIjpDuringMonth(
      {
        "episode-only-no-hours": {
          episodes: [{ service_id: GA_IJP, started_at: "2026-10-01", ended_at: null }],
          client: { current_service_id: GA_IJP, archived_at: null, is_demo: false },
          currentService: null,
        },
      },
      "2026-10-01",
      GA_IJP
    );
    const eligibility = unionClientIdLists(ids, episodeIds);
    assert.ok(eligibility.includes("episode-only-no-hours"));
    assert.ok(!ids.includes("episode-only-no-hours"));
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
