import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aggregateOfficeCaseCounts } from "./office-case-counts";

describe("aggregateOfficeCaseCounts", () => {
  it("counts non-archived clients per office and sorts by count desc", () => {
    const offices = [
      { id: "o-a", name: "Albany" },
      { id: "o-b", name: "Brunswick" },
    ];
    const clients = [
      { office_id: "o-a", archived_at: null },
      { office_id: "o-a", archived_at: null },
      { office_id: "o-b", archived_at: null },
      { office_id: null, archived_at: null },
      { office_id: "o-a", archived_at: new Date(Date.now() - 60_000).toISOString() },
    ];

    assert.deepEqual(aggregateOfficeCaseCounts(offices, clients), [
      { officeId: "o-a", officeName: "Albany", caseCount: 2 },
      { officeId: "o-b", officeName: "Brunswick", caseCount: 1 },
    ]);
  });
});
