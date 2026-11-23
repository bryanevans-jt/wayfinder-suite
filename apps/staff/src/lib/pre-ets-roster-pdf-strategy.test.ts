import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_ROSTER_TEMPLATE_ROWS,
  shouldUseBuiltInRosterPdf,
} from "./pre-ets-roster-pdf-strategy";

describe("pre-ets large roster PDF strategy", () => {
  it("uses built-in PDF for large classes that would timeout Docs expansion", () => {
    assert.equal(shouldUseBuiltInRosterPdf(MAX_ROSTER_TEMPLATE_ROWS), false);
    assert.equal(shouldUseBuiltInRosterPdf(MAX_ROSTER_TEMPLATE_ROWS + 1), true);
    // Fitzgerald Inclusion-sized roster
    assert.equal(shouldUseBuiltInRosterPdf(64), true);
  });
});
