import assert from "node:assert/strict";
import test from "node:test";
import { normalizeInstructorNameForLookup } from "./pre-ets-instructor-match";

test("normalizeInstructorNameForLookup strips parenthetical and normalizes spacing", () => {
  assert.equal(normalizeInstructorNameForLookup("TIFFANY POWELL"), "TIFFANY POWELL");
  assert.equal(
    normalizeInstructorNameForLookup("IVETTE CORDERO (Muscogee County)"),
    "IVETTE CORDERO"
  );
  assert.equal(normalizeInstructorNameForLookup("  EMERY   FAIRCLOTH  "), "EMERY FAIRCLOTH");
});
