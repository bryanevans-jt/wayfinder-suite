import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "./pre-ets-service-month";

describe("staff re-export of pre-ets-service-month", () => {
  it("exposes omit + parse helpers for API/UI callers", () => {
    assert.equal(isPreEtsServiceMonthFilterOmitted(""), true);
    assert.deepEqual(parsePreEtsServiceMonthFilter("2026-10"), {
      ok: true,
      serviceMonth: "2026-10-01",
      inputMonth: "2026-10",
    });
    assert.equal(parsePreEtsServiceMonthFilter("doollxx").ok, false);
  });
});
