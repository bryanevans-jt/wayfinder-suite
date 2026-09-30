import assert from "node:assert/strict";
import test from "node:test";
import { pickBestSchoolNameMatch, rankSchoolNameMatches } from "./pre-ets-school-name-match";

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
