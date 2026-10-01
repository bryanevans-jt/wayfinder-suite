import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeInstructorNameForLookup,
  scorePreEtsPersonNameMatch,
} from "./pre-ets-instructor-match";

test("normalizeInstructorNameForLookup strips parenthetical and normalizes spacing", () => {
  assert.equal(normalizeInstructorNameForLookup("TIFFANY POWELL"), "TIFFANY POWELL");
  assert.equal(
    normalizeInstructorNameForLookup("IVETTE CORDERO (Muscogee County)"),
    "IVETTE CORDERO"
  );
  assert.equal(normalizeInstructorNameForLookup("  EMERY   FAIRCLOTH  "), "EMERY FAIRCLOTH");
});

test("scorePreEtsPersonNameMatch matches ALL CAPS worksheet names to profile names", () => {
  assert.equal(scorePreEtsPersonNameMatch("TIFFANY POWELL", "Tiffany Powell"), 100);
  assert.equal(scorePreEtsPersonNameMatch("IVETTE CORDERO", "Ivette Cordero"), 100);
  assert.ok(scorePreEtsPersonNameMatch("TIFFANY POWELL", "Tiffany M Powell") >= 88);
  assert.ok(scorePreEtsPersonNameMatch("NADINE BOWLES", "Nadine Bowles") >= 95);
});

test("scorePreEtsPersonNameMatch handles comma names", () => {
  assert.ok(scorePreEtsPersonNameMatch("TIFFANY POWELL", "Powell, Tiffany") >= 95);
});
