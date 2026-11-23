import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRosterTableExtraRowInsertRequests } from "./pre-ets-google-doc-roster-table";

describe("pre-ets Docs roster table expansion", () => {
  it("batches extra row inserts targeting the template row in reverse stack order", () => {
    const requests = buildRosterTableExtraRowInsertRequests(12, 1, 64);
    assert.equal(requests.length, 63);
    for (const request of requests) {
      assert.equal(request.insertTableRow?.tableCellLocation?.rowIndex, 1);
      assert.equal(request.insertTableRow?.insertBelow, true);
      assert.equal(
        request.insertTableRow?.tableCellLocation?.tableStartLocation?.index,
        12
      );
    }
  });

  it("adds no insert requests for a single-student roster", () => {
    assert.deepEqual(buildRosterTableExtraRowInsertRequests(12, 1, 1), []);
    assert.deepEqual(buildRosterTableExtraRowInsertRequests(12, 1, 0), []);
  });
});
