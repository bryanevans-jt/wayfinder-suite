import assert from "node:assert/strict";
import test from "node:test";
import { pickBestSchoolNameMatch, rankSchoolNameMatches } from "./pre-ets-school-name-match";
import { canonicalizeWorksheetSchoolName } from "./pre-ets-worksheet-known-schools";

test("weak fuzzy matches stay below auto-remap threshold", () => {
  const candidates = [
    { name: "Northgate High School", source: "setup" as const },
    { name: "Northside High School", source: "setup" as const },
    { name: "Southgate High School", source: "setup" as const },
  ];
  const ranked = rankSchoolNameMatches("Northgate High School", candidates);
  assert.ok(ranked[0]?.score >= 0.95);

  const loose = pickBestSchoolNameMatch("Gateway High School", candidates);
  assert.ok(!loose.match || loose.match.score < 0.95);
});

test("Pike County and Upson Lee do not fuzzy-match each other", () => {
  const candidates = [
    { name: "Pike County High School", source: "setup" as const },
    { name: "Upson Lee High School", source: "setup" as const },
  ];
  const pike = pickBestSchoolNameMatch("Pike County High", candidates);
  assert.equal(pike.match?.name, "Pike County High School");
  assert.ok((pike.match?.score ?? 0) >= 0.95);

  const upson = pickBestSchoolNameMatch("UPSON LEE HIGH", candidates);
  assert.equal(upson.match?.name, "Upson Lee High School");
  assert.ok((upson.match?.score ?? 0) >= 0.95);
  assert.notEqual(upson.match?.name, "Pike County High School");
});

test("Scintilla Charter School Valdosta matches class setup Scintilla Charter School", () => {
  const candidates = [{ name: "Scintilla Charter School", source: "setup" as const }];
  const match = pickBestSchoolNameMatch(
    canonicalizeWorksheetSchoolName("SCINTILLA CHARTER SCHOOL VALDOSTA"),
    candidates
  );
  assert.equal(match.match?.name, "Scintilla Charter School");
  assert.ok((match.match?.score ?? 0) >= 0.95);
});
