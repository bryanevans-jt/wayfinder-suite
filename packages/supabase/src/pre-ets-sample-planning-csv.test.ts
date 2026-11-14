import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { parseDistrictWorksheet } from "./pre-ets-worksheet-parser";

const samplePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../apps/staff/public/demo/pre-ets-sample-planning.csv"
);

describe("pre-ets-sample-planning.csv", () => {
  it("parses the Help download sample with district, service month, and school year", () => {
    const csv = readFileSync(samplePath, "utf8");
    const parsed = parseDistrictWorksheet(csv);

    assert.equal(parsed.districtNumber, "9");
    assert.equal(parsed.monthLabel, "OCTOBER");
    assert.equal(parsed.schoolYear, "2026-2027");
    assert.equal(parsed.serviceMonth, "2026-10-01");
    assert.ok(parsed.stats.studentCount >= 1);
    assert.ok(parsed.stats.groupCount >= 1);
    assert.equal(
      parsed.issues.filter((i) => /missing required column/i.test(i)).length,
      0
    );
  });
});
