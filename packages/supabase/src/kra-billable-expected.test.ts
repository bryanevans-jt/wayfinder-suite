import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { expectedBillableMinutesForClients } from "./kra-billable-expected";

describe("expectedBillableMinutesForClients", () => {
  it("sums full monthly thresholds for each overlapping in-scope client", () => {
    // Mid-month handoff: both assignees get the full 10h expectation per client.
    assert.equal(
      expectedBillableMinutesForClients([
        { thresholdHours: 10 },
        { thresholdHours: 10 },
        { thresholdHours: 10 },
      ]),
      30 * 60
    );
  });

  it("ignores non-positive thresholds", () => {
    assert.equal(
      expectedBillableMinutesForClients([
        { thresholdHours: 10 },
        { thresholdHours: 0 },
        { thresholdHours: -1 },
      ]),
      600
    );
  });
});
