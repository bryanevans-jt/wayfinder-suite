import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientHasBillableTimeFromEntries,
  clientOnGaIjpDuringMonthFromRows,
  filterClientIdsOnGaIjpDuringMonth,
  filterClientIdsWithBillableTime,
} from "./ijp-billing-eligibility";

const GA_IJP = "svc-ga-ijp";

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

  it("detects billable minutes from activity embed", () => {
    assert.equal(
      clientHasBillableTimeFromEntries([
        {
          duration_minutes: 45,
          service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
        },
      ]),
      true
    );
    assert.equal(
      clientHasBillableTimeFromEntries([
        {
          duration_minutes: 45,
          service_activity_types: { code: "JT-ACT-099", counts_toward_client_billable: false },
        },
      ]),
      false
    );
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
      a: [
        {
          duration_minutes: 30,
          service_activity_types: { code: "JT-ACT-001", counts_toward_client_billable: true },
        },
      ],
      b: [
        {
          duration_minutes: 30,
          service_activity_types: { code: "JT-ACT-099", counts_toward_client_billable: false },
        },
      ],
    });
    assert.deepEqual(ids, ["a"]);
  });
});
