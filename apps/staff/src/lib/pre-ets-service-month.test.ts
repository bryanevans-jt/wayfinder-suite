import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isPreEtsServiceMonthFilterOmitted,
  parsePreEtsServiceMonthFilter,
} from "./pre-ets-service-month";

describe("isPreEtsServiceMonthFilterOmitted", () => {
  it("treats null, undefined, empty, and whitespace as omitted", () => {
    assert.equal(isPreEtsServiceMonthFilterOmitted(null), true);
    assert.equal(isPreEtsServiceMonthFilterOmitted(undefined), true);
    assert.equal(isPreEtsServiceMonthFilterOmitted(""), true);
    assert.equal(isPreEtsServiceMonthFilterOmitted("   "), true);
  });

  it("does not treat partial or full values as omitted", () => {
    assert.equal(isPreEtsServiceMonthFilterOmitted("d"), false);
    assert.equal(isPreEtsServiceMonthFilterOmitted("2026-10"), false);
  });
});

describe("parsePreEtsServiceMonthFilter", () => {
  it("normalizes YYYY-MM to first-of-month", () => {
    assert.deepEqual(parsePreEtsServiceMonthFilter("2026-10"), {
      ok: true,
      serviceMonth: "2026-10-01",
      inputMonth: "2026-10",
    });
  });

  it("accepts a valid YYYY-MM-DD passthrough", () => {
    assert.deepEqual(parsePreEtsServiceMonthFilter("2026-10-01"), {
      ok: true,
      serviceMonth: "2026-10-01",
      inputMonth: "2026-10",
    });
    assert.deepEqual(parsePreEtsServiceMonthFilter("2026-10-15"), {
      ok: true,
      serviceMonth: "2026-10-15",
      inputMonth: "2026-10",
    });
  });

  it("trims surrounding whitespace before validating", () => {
    assert.deepEqual(parsePreEtsServiceMonthFilter(" 2026-10 "), {
      ok: true,
      serviceMonth: "2026-10-01",
      inputMonth: "2026-10",
    });
  });

  it("rejects progressive free-text fragments from monitoring", () => {
    for (const bad of ["d", "do", "dool", "Dougherty"]) {
      const result = parsePreEtsServiceMonthFilter(bad);
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.error, /YYYY-MM/);
      }
    }
  });

  it("rejects impossible months and calendar dates", () => {
    for (const bad of ["2026-13", "2026-00", "2026-02-30", "2026-04-31", "2026-1", "26-10"]) {
      const result = parsePreEtsServiceMonthFilter(bad);
      assert.equal(result.ok, false, bad);
    }
  });

  it("rejects empty after trim via parse (caller should omit filter instead)", () => {
    const result = parsePreEtsServiceMonthFilter("  ");
    assert.equal(result.ok, false);
  });

  it("rejects length-7 garbage that the old length===7 path would have appended -01 to", () => {
    const result = parsePreEtsServiceMonthFilter("doollxx");
    assert.equal(result.ok, false);
  });
});
