import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeWorksheetSchoolName,
  looksLikeKnownWorksheetSchoolLabel,
} from "./pre-ets-worksheet-known-schools";

test("Upson Lee is a known school label without High", () => {
  assert.ok(looksLikeKnownWorksheetSchoolLabel("UPSON LEE"));
  assert.equal(canonicalizeWorksheetSchoolName("UPSON LEE"), "Upson Lee High School");
  assert.equal(canonicalizeWorksheetSchoolName("UPSON-LEE HIGH"), "Upson Lee High School");
});
